import { sendSmtpMail } from "@/lib/smtp";
import { brand } from "@/lib/site";
import { formatCountryName, formatDateFr, formatMoney, formatPhoneNumber, formatProperName } from "@/lib/format";
import { generatePremiumAppointmentInvoicePdf } from "@/lib/appointment-invoice";
import {
  consultationModeLabels,
  consultationTypes,
  formatDateTimeFr,
  type Appointment,
  type AppointmentStatus,
  type ConsultationMode,
  type ConsultationType,
} from "@/lib/booking-shared";

export { consultationModeLabels, consultationTypes, formatDateTimeFr };
export type { Appointment, AppointmentStatus, ConsultationMode, ConsultationType };

export type AppointmentInput = {
  consultationType: ConsultationType;
  startsAt: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  reason: string;
  consultationMode: ConsultationMode;
};

const timeSlots = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"];
const bookingTimeZone = "America/Toronto";

function logBooking(stage: string, sessionId: string, details: Record<string, unknown> = {}) {
  console.info("[appointment-booking]", JSON.stringify({ stage, sessionId, ...details }));
}

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configuration Supabase manquante.");

  return {
    url,
    key,
    table: process.env.SUPABASE_APPOINTMENTS_TABLE || "client_appointments",
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
    siteUrl: (process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || "https://acces-canada.vercel.app").replace(/\/$/, ""),
  };
}

function headers(key: string) {
  const authHeaders: Record<string, string> = key.startsWith("sb_secret_")
    ? { apikey: key }
    : { apikey: key, Authorization: `Bearer ${key}` };

  return { ...authHeaders, "Content-Type": "application/json" };
}

async function supabaseError(action: string, response: Response) {
  throw new Error(`${action} Supabase échouée (${response.status}) : ${await response.text()}`);
}

function addMinutes(value: string | Date, minutes: number) {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(date.getTime() + minutes * 60_000);
}

function timeZoneOffsetMinutes(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((values, part) => {
      if (part.type !== "literal") values[part.type] = part.value;
      return values;
    }, {});

  const zonedAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );

  return (zonedAsUtc - date.getTime()) / 60_000;
}

function torontoSlotToUtc(date: Date, hours: number, minutes: number) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const firstPass = new Date(Date.UTC(year, month, day, hours, minutes, 0, 0));
  const firstOffset = timeZoneOffsetMinutes(firstPass, bookingTimeZone);
  const secondPass = new Date(Date.UTC(year, month, day, hours, minutes, 0, 0) - firstOffset * 60_000);
  const secondOffset = timeZoneOffsetMinutes(secondPass, bookingTimeZone);
  return new Date(Date.UTC(year, month, day, hours, minutes, 0, 0) - secondOffset * 60_000);
}

function normalizeAppointmentInput(input: AppointmentInput) {
  const type = consultationTypes[input.consultationType];
  if (!type) throw new Error("Type de consultation invalide.");

  const starts = new Date(input.startsAt);
  if (Number.isNaN(starts.getTime())) throw new Error("Créneau invalide.");

  const firstName = formatProperName(input.firstName);
  const lastName = formatProperName(input.lastName);
  const email = input.email.trim().toLowerCase();
  const phone = formatPhoneNumber(input.phone);
  const country = formatCountryName(input.country);
  const reason = input.reason.trim();
  const fullName = `${firstName} ${lastName}`.trim();

  if (!firstName || !lastName || !email || !phone || !country || !reason) {
    throw new Error("Tous les champs du rendez-vous sont obligatoires.");
  }

  if (!consultationModeLabels[input.consultationMode]) {
    throw new Error("Mode de consultation invalide.");
  }

  return {
    ...input,
    firstName,
    lastName,
    fullName,
    email,
    phone,
    country,
    reason,
    type,
    starts,
    ends: addMinutes(starts, type.durationMinutes),
  };
}

export async function listAvailableSlots(consultationType: ConsultationType) {
  const type = consultationTypes[consultationType] || consultationTypes.consultation_30;
  const { url, key, table } = config();
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() + 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 30);

  const response = await fetch(
    `${url}/rest/v1/${table}?status=eq.confirmed&starts_at=gte.${encodeURIComponent(start.toISOString())}&starts_at=lt.${encodeURIComponent(end.toISOString())}&select=starts_at,duration_minutes`,
    { headers: headers(key), cache: "no-store" },
  );
  if (!response.ok) await supabaseError("Lecture des rendez-vous", response);
  const appointments = (await response.json()) as Pick<Appointment, "starts_at" | "duration_minutes">[];
  const occupied = new Set(appointments.map((appointment) => new Date(appointment.starts_at).toISOString()));

  const slots: { value: string; label: string }[] = [];
  for (let day = 0; day < 30; day += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + day);
    const weekday = date.getDay();
    if (weekday === 0 || weekday === 6) continue;

    for (const time of timeSlots) {
      const [hours, minutes] = time.split(":").map(Number);
      const slot = torontoSlotToUtc(date, hours, minutes);
      if (slot <= now) continue;
      if (occupied.has(slot.toISOString())) continue;
      if (type.durationMinutes === 60 && time === "16:00") continue;
      slots.push({ value: slot.toISOString(), label: formatDateTimeFr(slot) });
    }
  }

  return slots;
}

export async function listAppointments(filters: { status?: string; date?: string; search?: string } = {}) {
  const { url, key, table } = config();
  const query = new URLSearchParams({
    select: "*",
    order: "starts_at.desc",
  });
  if (filters.status) query.set("status", `eq.${filters.status}`);
  if (filters.date) {
    const start = new Date(`${filters.date}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    query.set("starts_at", `gte.${start.toISOString()}`);
    query.append("starts_at", `lt.${end.toISOString()}`);
  }

  const response = await fetch(`${url}/rest/v1/${table}?${query.toString()}`, { headers: headers(key), cache: "no-store" });
  if (!response.ok) await supabaseError("Liste des rendez-vous", response);
  const appointments = (await response.json()) as Appointment[];
  const search = filters.search?.trim().toLowerCase();
  if (!search) return appointments;

  return appointments.filter((appointment) =>
    [
      appointment.client_full_name,
      appointment.client_email,
      appointment.client_phone,
      appointment.booking_reference,
      appointment.invoice_number,
    ]
      .join(" ")
      .toLowerCase()
      .includes(search),
  );
}

export async function listAppointmentsForEmail(email: string) {
  const { url, key, table } = config();
  const response = await fetch(
    `${url}/rest/v1/${table}?client_email=eq.${encodeURIComponent(email.toLowerCase())}&select=*&order=starts_at.desc`,
    { headers: headers(key), cache: "no-store" },
  );
  if (!response.ok) await supabaseError("Liste des factures de rendez-vous", response);
  return (await response.json()) as Appointment[];
}

export async function getAppointment(id: string) {
  const { url, key, table } = config();
  const response = await fetch(`${url}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&select=*&limit=1`, {
    headers: headers(key),
    cache: "no-store",
  });
  if (!response.ok) await supabaseError("Lecture du rendez-vous", response);
  return ((await response.json()) as Appointment[])[0] || null;
}

export async function getAppointmentByStripeSession(sessionId: string) {
  const { url, key, table } = config();
  const response = await fetch(`${url}/rest/v1/${table}?stripe_session_id=eq.${encodeURIComponent(sessionId)}&select=*&limit=1`, {
    headers: headers(key),
    cache: "no-store",
  });
  if (!response.ok) await supabaseError("Lecture du rendez-vous Stripe", response);
  return ((await response.json()) as Appointment[])[0] || null;
}

async function nextReference(prefix: "AC-RDV" | "AC-FAC") {
  const { url, key, table } = config();
  const year = new Date().getFullYear();
  const pattern = `${prefix}-${year}-`;
  const response = await fetch(
    `${url}/rest/v1/${table}?select=booking_reference,invoice_number&order=created_at.desc&limit=500`,
    { headers: headers(key), cache: "no-store" },
  );
  if (!response.ok) await supabaseError("Génération de référence", response);
  const rows = (await response.json()) as Appointment[];
  const numbers = rows
    .map((row) => (prefix === "AC-RDV" ? row.booking_reference : row.invoice_number))
    .filter((value) => String(value).startsWith(pattern))
    .map((value) => Number(String(value).split("-").pop()))
    .filter((value) => Number.isFinite(value));
  const next = Math.max(0, ...numbers) + 1;
  return `${pattern}${String(next).padStart(4, "0")}`;
}

export async function createAppointmentCheckout(input: AppointmentInput) {
  const { stripeSecretKey, siteUrl } = config();
  if (!stripeSecretKey) throw new Error("STRIPE_SECRET_KEY est manquant.");
  const normalized = normalizeAppointmentInput(input);

  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("locale", "fr");
  params.set("success_url", `${siteUrl}/rendez-vous?paiement=confirme&session_id={CHECKOUT_SESSION_ID}`);
  params.set("cancel_url", `${siteUrl}/rendez-vous?paiement=annule`);
  params.set("customer_email", normalized.email);
  params.set("client_reference_id", normalized.email);
  params.set("metadata[workflow]", "appointment_booking");
  params.set("metadata[consultation_type]", input.consultationType);
  params.set("metadata[starts_at]", normalized.starts.toISOString());
  params.set("metadata[ends_at]", normalized.ends.toISOString());
  params.set("metadata[first_name]", normalized.firstName);
  params.set("metadata[last_name]", normalized.lastName);
  params.set("metadata[email]", normalized.email);
  params.set("metadata[phone]", normalized.phone);
  params.set("metadata[country]", normalized.country);
  params.set("metadata[reason]", normalized.reason.slice(0, 450));
  params.set("metadata[consultation_mode]", input.consultationMode);
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price_data][currency]", "usd");
  params.set("line_items[0][price_data][unit_amount]", String(normalized.type.amountCents));
  params.set("line_items[0][price_data][product_data][name]", normalized.type.label);
  params.set("line_items[0][price_data][product_data][description]", normalized.type.description);

  const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  const stripeSession = (await stripeResponse.json()) as { id?: string; url?: string; error?: { message?: string } };
  if (!stripeResponse.ok || !stripeSession.id || !stripeSession.url) {
    throw new Error(stripeSession.error?.message || "Création de session Stripe impossible.");
  }

  return { checkoutUrl: stripeSession.url };
}

export async function confirmAppointmentFromStripeSession(session: {
  id?: string;
  payment_status?: string | null;
  payment_intent?: string | null;
  payment_method_types?: string[];
  metadata?: Record<string, string | undefined> | null;
}) {
  if (!session.id || session.metadata?.workflow !== "appointment_booking") return null;
  logBooking("session_received", session.id, { paymentStatus: session.payment_status });
  if (session.payment_status !== "paid") {
    throw new Error(`La session Stripe ${session.id} n'est pas payée.`);
  }

  const { url, key, table } = config();
  logBooking("supabase_lookup_start", session.id, { table });
  const existingResponse = await fetch(`${url}/rest/v1/${table}?stripe_session_id=eq.${encodeURIComponent(session.id)}&select=*&limit=1`, {
    headers: headers(key),
    cache: "no-store",
  });
  if (!existingResponse.ok) await supabaseError("Lecture du rendez-vous Stripe", existingResponse);
  const existing = ((await existingResponse.json()) as Appointment[])[0];
  if (existing) {
    logBooking("appointment_existing", session.id, { appointmentId: existing.id });
    await sendAppointmentConfirmationEmail(existing);
    logBooking("email_complete", session.id, { appointmentId: existing.id });
    return existing;
  }

  const metadata = session.metadata || {};
  const normalized = normalizeAppointmentInput({
    consultationType: metadata.consultation_type as ConsultationType,
    startsAt: metadata.starts_at || "",
    firstName: metadata.first_name || "",
    lastName: metadata.last_name || "",
    email: metadata.email || "",
    phone: metadata.phone || "",
    country: metadata.country || "",
    reason: metadata.reason || "",
    consultationMode: metadata.consultation_mode as ConsultationMode,
  });

  const conflictResponse = await fetch(
    `${url}/rest/v1/${table}?status=eq.confirmed&starts_at=eq.${encodeURIComponent(normalized.starts.toISOString())}&select=id&limit=1`,
    { headers: headers(key), cache: "no-store" },
  );
  if (!conflictResponse.ok) await supabaseError("Vérification du créneau", conflictResponse);
  if (((await conflictResponse.json()) as { id: string }[]).length) {
    throw new Error("Ce créneau vient d'être réservé. Une intervention administrative est nécessaire pour replacer le paiement.");
  }
  logBooking("slot_available", session.id);

  const bookingReference = await nextReference("AC-RDV");
  const invoiceNumber = await nextReference("AC-FAC");
  logBooking("references_created", session.id, { bookingReference, invoiceNumber });
  const appointmentPayload = {
    stripe_session_id: session.id,
    stripe_payment_intent: session.payment_intent || null,
    booking_reference: bookingReference,
    invoice_number: invoiceNumber,
    status: "confirmed",
    confirmed_at: new Date().toISOString(),
    consultation_type: normalized.consultationType,
    duration_minutes: normalized.type.durationMinutes,
    amount_cents: normalized.type.amountCents,
    currency: "USD",
    client_first_name: normalized.firstName,
    client_last_name: normalized.lastName,
    client_full_name: normalized.fullName,
    client_email: normalized.email,
    client_phone: normalized.phone,
    client_country: normalized.country,
    reason: normalized.reason,
    consultation_mode: normalized.consultationMode,
    starts_at: normalized.starts.toISOString(),
    ends_at: normalized.ends.toISOString(),
    payment_method_label: session.payment_method_types?.[0] || "Carte bancaire",
  };

  const insertResponse = await fetch(`${url}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...headers(key), Prefer: "return=representation" },
    body: JSON.stringify(appointmentPayload),
  });
  if (!insertResponse.ok) await supabaseError("Confirmation du rendez-vous", insertResponse);
  const appointment = ((await insertResponse.json()) as Appointment[])[0];
  logBooking("appointment_inserted", session.id, { appointmentId: appointment.id });
  await sendAppointmentConfirmationEmail(appointment);
  logBooking("email_complete", session.id, { appointmentId: appointment.id });
  return appointment;
}

function invoiceRows(appointment: Appointment) {
  return [
    ["Facture", appointment.invoice_number],
    ["Statut", "Facture acquittée"],
    ["Date du paiement", formatDateFr(appointment.confirmed_at || appointment.created_at)],
    ["Client", appointment.client_full_name],
    ["Courriel", appointment.client_email],
    ["Téléphone", appointment.client_phone],
    ["Pays", appointment.client_country],
    ["Service", consultationTypes[appointment.consultation_type].label],
    ["Durée", `${appointment.duration_minutes} minutes`],
    ["Mode", consultationModeLabels[appointment.consultation_mode]],
    ["Date du rendez-vous", formatDateTimeFr(appointment.starts_at)],
    ["Montant payé", `${formatMoney(appointment.amount_cents / 100)} USD`],
    ["Devise", appointment.currency || "USD"],
    ["Méthode de paiement", appointment.payment_method_label || "Carte bancaire"],
    ["Transaction Stripe", appointment.stripe_payment_intent || appointment.stripe_session_id],
  ];
}

function safe(value: string | number | null | undefined) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function writeObject(parts: string[], index: number, body: string, offsets: number[]) {
  offsets[index] = parts.join("").length;
  parts.push(`${index} 0 obj\n${body}\nendobj\n`);
}

function generateAppointmentInvoicePdfLegacy(appointment: Appointment) {
  const content: string[] = [];
  let y = 620;

  content.push("q 0.98 0.965 0.925 rg 0 0 612 792 re f Q\n");
  content.push("q 0.043 0.114 0.212 rg 0 690 612 102 re f Q\n");
  content.push("q 0.831 0.686 0.216 rg 36 676 540 3 re f Q\n");
  content.push("q 0.831 0.686 0.216 rg 36 724 48 48 re f Q\n");
  content.push("q 0.8 0.063 0.18 rg 42 730 36 36 re f Q\n");
  content.push("BT /F2 16 Tf 1 1 1 rg 48 743 Td (AC) Tj ET\n");
  content.push("BT /F2 24 Tf 1 1 1 rg 100 752 Td (ACCÈS CANADA) Tj ET\n");
  content.push(`BT /F1 10 Tf 1 1 1 rg 100 733 Td (${safe(brand.slogan)}) Tj ET\n`);
  content.push("BT /F2 22 Tf 0.043 0.114 0.212 rg 36 646 Td (Facture acquittée) Tj ET\n");
  content.push(`BT /F2 11 Tf 0.8 0.063 0.18 rg 390 646 Td (${safe(appointment.invoice_number)}) Tj ET\n`);

  invoiceRows(appointment).forEach(([label, value]) => {
    content.push(`q 1 1 1 rg 36 ${y - 19} 540 30 re f Q\n`);
    content.push(`BT /F2 9 Tf 0.043 0.114 0.212 rg 52 ${y} Td (${safe(label)}) Tj ET\n`);
    content.push(`BT /F1 10 Tf 0.12 0.12 0.12 rg 230 ${y} Td (${safe(value)}) Tj ET\n`);
    y -= 36;
  });

  content.push("q 0.043 0.114 0.212 rg 36 84 540 74 re f Q\n");
  content.push("BT /F2 11 Tf 1 1 1 rg 54 130 Td (Coordonnées Accès Canada) Tj ET\n");
  content.push(`BT /F1 9 Tf 1 1 1 rg 54 112 Td (${safe(`${brand.phone} | ${brand.email}`)}) Tj ET\n`);
  content.push("BT /F1 9 Tf 1 1 1 rg 54 96 Td (Canada et international) Tj ET\n");
  content.push("BT /F1 8 Tf 0.3 0.3 0.3 rg 36 46 Td (Aucune taxe n'est affichée ou calculée pour le moment.) Tj ET\n");

  const stream = content.join("");
  const parts = ["%PDF-1.4\n"];
  const offsets = [0];
  writeObject(parts, 1, "<< /Type /Catalog /Pages 2 0 R >>", offsets);
  writeObject(parts, 2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", offsets);
  writeObject(
    parts,
    3,
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    offsets,
  );
  writeObject(parts, 4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>", offsets);
  writeObject(parts, 5, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>", offsets);
  writeObject(parts, 6, `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`, offsets);

  const xref = parts.join("").length;
  parts.push("xref\n0 7\n0000000000 65535 f \n");
  for (let index = 1; index <= 6; index += 1) {
    parts.push(`${String(offsets[index]).padStart(10, "0")} 00000 n \n`);
  }
  parts.push(`trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return Buffer.from(parts.join(""), "latin1");
}

export function generateAppointmentInvoicePdf(appointment: Appointment) {
  return generatePremiumAppointmentInvoicePdf(appointment);
}

export async function sendAppointmentConfirmationEmail(appointment: Appointment) {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const from = process.env.SMTP_FROM?.trim() || user;
  const missing = [
    ["SMTP_HOST", host],
    ["SMTP_USER", user],
    ["SMTP_PASS", pass],
    ["SMTP_FROM", from],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length) {
    throw new Error(`Configuration SMTP incomplète: ${missing.join(", ")}.`);
  }
  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    throw new Error("Configuration SMTP invalide: SMTP_PORT doit être un port valide.");
  }

  logBooking("pdf_start", appointment.stripe_session_id, { appointmentId: appointment.id });
  const invoice = generateAppointmentInvoicePdf(appointment);
  logBooking("pdf_complete", appointment.stripe_session_id, { appointmentId: appointment.id, bytes: invoice.length });
  logBooking("smtp_start", appointment.stripe_session_id, { appointmentId: appointment.id, host, port });
  await sendSmtpMail({
    host: host!,
    port,
    secure: process.env.SMTP_SECURE === "true" || (process.env.SMTP_SECURE == null && port === 465),
    startTls: port !== 465 && process.env.SMTP_STARTTLS !== "false",
    user: user!,
    pass: pass!,
    from: from!,
    to: appointment.client_email,
    subject: `Accès Canada - rendez-vous confirmé ${appointment.booking_reference}`,
    text: `Bonjour ${appointment.client_full_name},

Votre rendez-vous Accès Canada est confirmé.

${brand.slogan}

Type de consultation: ${consultationTypes[appointment.consultation_type].label}
Date et heure: ${formatDateTimeFr(appointment.starts_at)}
Durée: ${appointment.duration_minutes} minutes
Mode: ${consultationModeLabels[appointment.consultation_mode]}
Montant payé: ${formatMoney(appointment.amount_cents / 100)} USD
Numéro de réservation: ${appointment.booking_reference}
Facture: ${appointment.invoice_number}

Informations utiles:
- Merci d'être disponible quelques minutes avant l'heure prévue.
- Préparez les documents ou questions liés à votre projet.
- Pour une visioconférence, le lien vous sera communiqué avant le rendez-vous si nécessaire.

Accès Canada
${brand.phone}
${brand.email}`,
    attachments: [
      {
        filename: `${appointment.invoice_number}.pdf`,
        contentType: "application/pdf",
        content: invoice,
      },
    ],
  });
  logBooking("smtp_accepted", appointment.stripe_session_id, { appointmentId: appointment.id });
}

export async function cancelAppointment(id: string) {
  const { url, key, table } = config();
  const response = await fetch(`${url}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { ...headers(key), Prefer: "return=representation" },
    body: JSON.stringify({ status: "cancelled", cancelled_at: new Date().toISOString() }),
  });
  if (!response.ok) await supabaseError("Annulation du rendez-vous", response);
  return ((await response.json()) as Appointment[])[0];
}

export async function moveAppointment(id: string, startsAt: string) {
  const appointment = await getAppointment(id);
  if (!appointment) throw new Error("Rendez-vous introuvable.");
  const starts = new Date(startsAt);
  if (Number.isNaN(starts.getTime())) throw new Error("Nouvelle date invalide.");
  const ends = addMinutes(starts, appointment.duration_minutes);
  const { url, key, table } = config();
  const response = await fetch(`${url}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { ...headers(key), Prefer: "return=representation" },
    body: JSON.stringify({ starts_at: starts.toISOString(), ends_at: ends.toISOString(), updated_at: new Date().toISOString() }),
  });
  if (!response.ok) await supabaseError("Déplacement du rendez-vous", response);
  return ((await response.json()) as Appointment[])[0];
}
