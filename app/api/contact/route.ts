import { NextResponse } from "next/server";
import { brand } from "@/lib/site";
import { sendSmtpMail } from "@/lib/smtp";

export const runtime = "nodejs";

const CONTACT_PHONE = "+1 819-266-8420";

type ContactPayload = {
  name?: string;
  email?: string;
  phone?: string;
  service?: string;
  country?: string;
  preferredDate?: string;
  message?: string;
};

type ContactRecord = {
  full_name: string;
  email: string;
  phone: string | null;
  service: string;
  country: string | null;
  preferred_date: string | null;
  message: string;
  status: "new";
  source: "website";
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value: unknown, maxLength = 2000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Variable d'environnement manquante: ${name}`);
  }
  return value;
}

function getPayload(body: ContactPayload) {
  return {
    name: clean(body.name, 160),
    email: clean(body.email, 254).toLowerCase(),
    phone: clean(body.phone, 80),
    service: clean(body.service, 160),
    country: clean(body.country, 160),
    preferredDate: clean(body.preferredDate, 40),
    message: clean(body.message, 3000),
  };
}

function buildAdminEmailText(payload: ReturnType<typeof getPayload>, submittedAt: string) {
  return [
    "Nouvelle demande reçue depuis le formulaire Accès Canada",
    "",
    `Date de réception : ${submittedAt}`,
    `Nom complet : ${payload.name}`,
    `Courriel : ${payload.email}`,
    `Téléphone : ${payload.phone || "Non renseigné"}`,
    `Service souhaité : ${payload.service}`,
    `Pays de résidence : ${payload.country || "Non renseigné"}`,
    `Date souhaitée : ${payload.preferredDate || "Non renseignée"}`,
    "",
    "Message :",
    payload.message,
  ].join("\n");
}

function buildClientEmailText(payload: ReturnType<typeof getPayload>) {
  return [
    `Bonjour ${payload.name},`,
    "",
    "Nous confirmons la réception de votre demande auprès d'Accès Canada.",
    "Notre équipe analysera votre message et vous répondra dès que possible avec une première orientation professionnelle.",
    "",
    "Résumé de votre demande :",
    `Service souhaité : ${payload.service}`,
    `Pays de résidence : ${payload.country || "Non renseigné"}`,
    `Date souhaitée : ${payload.preferredDate || "Non renseignée"}`,
    "",
    "Votre message :",
    payload.message,
    "",
    "Accès Canada",
    "Votre chemin vers le Canada, notre engagement.",
    `${CONTACT_PHONE} | ${brand.email}`,
  ].join("\n");
}

async function insertContactRequest(record: ContactRecord) {
  const supabaseUrl = requiredEnv("SUPABASE_URL").replace(/\/$/, "");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const table = process.env.SUPABASE_CONTACT_TABLE?.trim() || "contact_requests";

  const response = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(record),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Insertion Supabase échouée: ${details}`);
  }

  return response.json();
}

async function sendEmails(payload: ReturnType<typeof getPayload>, submittedAt: string) {
  const smtpHost = requiredEnv("SMTP_HOST");
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = requiredEnv("SMTP_USER");
  const smtpPass = requiredEnv("SMTP_PASS");
  const smtpFrom = process.env.SMTP_FROM?.trim() || smtpUser;
  const contactTo = process.env.CONTACT_TO_EMAIL?.trim() || brand.email;

  const baseMail = {
    host: smtpHost,
    port: smtpPort,
    secure: process.env.SMTP_SECURE === "true" || smtpPort === 465,
    startTls: process.env.SMTP_STARTTLS !== "false",
    user: smtpUser,
    pass: smtpPass,
    from: smtpFrom,
  };

  await Promise.all([
    sendSmtpMail({
      ...baseMail,
      to: contactTo,
      replyTo: payload.email,
      subject: `Nouvelle demande Accès Canada - ${payload.name}`,
      text: buildAdminEmailText(payload, submittedAt),
    }),
    sendSmtpMail({
      ...baseMail,
      to: payload.email,
      replyTo: contactTo,
      subject: "Accès Canada - confirmation de réception",
      text: buildClientEmailText(payload),
    }),
  ]);
}

export async function POST(request: Request) {
  try {
    const payload = getPayload((await request.json()) as ContactPayload);

    if (!payload.name || !payload.email || !payload.service || !payload.message) {
      return NextResponse.json(
        { message: "Veuillez remplir le nom, le courriel, le service souhaité et le message." },
        { status: 400 },
      );
    }

    if (!emailRegex.test(payload.email)) {
      return NextResponse.json({ message: "Veuillez entrer une adresse courriel valide." }, { status: 400 });
    }

    const submittedAt = new Date().toISOString();

    await insertContactRequest({
      full_name: payload.name,
      email: payload.email,
      phone: payload.phone || null,
      service: payload.service,
      country: payload.country || null,
      preferred_date: payload.preferredDate || null,
      message: payload.message,
      status: "new",
      source: "website",
    });

    await sendEmails(payload, submittedAt);

    return NextResponse.json({
      message: "Votre demande a bien été envoyée. Un e-mail de confirmation vient de vous être transmis.",
    });
  } catch (error) {
    console.error("Erreur formulaire contact:", error);
    return NextResponse.json(
      {
        message:
          "Impossible d'envoyer la demande pour le moment. Vérifiez la configuration Supabase/Gmail ou écrivez directement par courriel.",
      },
      { status: 500 },
    );
  }
}
