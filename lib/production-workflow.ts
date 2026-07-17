import { getClient, updateClient, type AdminClient, type ClientInput } from "@/lib/admin-data";
import { documentLabels, type ClientDocumentType } from "@/lib/pdf-documents";
import { sendSmtpMail, smtpSecurityForPort } from "@/lib/smtp";
import { formatUsd } from "@/lib/format";
import { assertStripeKeyForEnvironment } from "@/lib/stripe-webhook";

export type SignatureStatus = "pending" | "signed" | "declined";
export type PaymentStatus = "pending" | "paid" | "failed" | "cancelled";

export type ClientSignature = {
  id: string;
  created_at: string;
  signed_at: string | null;
  client_id: string;
  document_id: string | null;
  document_type: ClientDocumentType;
  document_label: string;
  signer_name: string;
  signer_email: string;
  signature_text: string | null;
  consent_text: string | null;
  ip_address: string | null;
  user_agent: string | null;
  status: SignatureStatus;
};

export type ClientPayment = {
  id: string;
  created_at: string;
  paid_at: string | null;
  client_id: string;
  amount_cents: number;
  currency: string;
  description: string;
  status: PaymentStatus;
  stripe_session_id: string | null;
  stripe_payment_intent: string | null;
  checkout_url: string | null;
};

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configuration Supabase manquante.");

  return {
    url,
    key,
    signaturesTable: process.env.SUPABASE_CLIENT_SIGNATURES_TABLE || "client_document_signatures",
    paymentsTable: process.env.SUPABASE_CLIENT_PAYMENTS_TABLE || "client_payments",
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
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

function clientToInput(client: AdminClient, action: string): ClientInput {
  return {
    full_name: client.full_name,
    email: client.email,
    phone: client.phone || undefined,
    country: client.country || undefined,
    service: client.service,
    status: client.status,
    file_reference: client.file_reference || undefined,
    notes: client.notes || undefined,
    public_notes: client.public_notes || undefined,
    internal_notes: client.internal_notes || undefined,
    documents_received: client.documents_received || [],
    documents_missing: client.documents_missing || [],
    paid_amount: Number(client.paid_amount || 0),
    action_history: [...(client.action_history || []), { date: new Date().toISOString(), action }].slice(-100),
  };
}

export async function notifyClient(client: AdminClient, subject: string, message: string) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;

  if (!host || !user || !pass || !from) {
    console.warn("Notification courriel ignorée: configuration SMTP incomplète.");
    return;
  }

  await sendSmtpMail({
    host,
    port,
    ...smtpSecurityForPort(port),
    user,
    pass,
    from,
    to: client.email,
    subject,
    text: message,
  });
}

export async function notifyDossierCreated(client: AdminClient) {
  await notifyClient(
    client,
    "Accès Canada - votre dossier est créé",
    `Bonjour ${client.full_name},

Votre dossier Accès Canada a été créé avec succès.

Référence: ${client.file_reference || "à confirmer"}
Statut: ${client.status}

Vous pouvez maintenant accéder à votre espace client sécurisé pour suivre votre dossier et transmettre vos documents.

Accès Canada`,
  );
}

export async function notifyStatusChanged(client: AdminClient, statusLabel: string) {
  await notifyClient(
    client,
    "Accès Canada - mise à jour de votre dossier",
    `Bonjour ${client.full_name},

Le statut de votre dossier a été mis à jour.

Nouveau statut: ${statusLabel}
Référence: ${client.file_reference || "à confirmer"}

Accès Canada`,
  );
}

export async function listClientSignatures(clientId: string) {
  const { url, key, signaturesTable } = config();
  const response = await fetch(
    `${url}/rest/v1/${signaturesTable}?client_id=eq.${encodeURIComponent(clientId)}&select=*&order=created_at.desc`,
    { headers: headers(key), cache: "no-store" },
  );
  if (!response.ok) await supabaseError("Liste signatures", response);
  return (await response.json()) as ClientSignature[];
}

export async function requestSignature(client: AdminClient, documentType: ClientDocumentType, documentId?: string | null) {
  const { url, key, signaturesTable } = config();
  const response = await fetch(`${url}/rest/v1/${signaturesTable}`, {
    method: "POST",
    headers: { ...headers(key), Prefer: "return=representation" },
    body: JSON.stringify({
      client_id: client.id,
      document_id: documentId || null,
      document_type: documentType,
      document_label: documentLabels[documentType],
      signer_name: client.full_name,
      signer_email: client.email,
      status: "pending",
    }),
  });
  if (!response.ok) await supabaseError("Création signature", response);
  const signature = ((await response.json()) as ClientSignature[])[0];

  await updateClient(client.id, clientToInput(client, `Signature demandée: ${signature.document_label}.`));
  await notifyClient(
    client,
    "Accès Canada - document à signer",
    `Bonjour ${client.full_name},

Un document est disponible pour signature dans votre espace client sécurisé.

Document: ${signature.document_label}

Accès Canada`,
  ).catch((error) => console.error("Notification signature non envoyée:", error));

  return signature;
}

export async function signDocument(signatureId: string, client: AdminClient, signatureText: string, request: Request) {
  const { url, key, signaturesTable } = config();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null;
  const userAgent = request.headers.get("user-agent");
  const consentText = "Je confirme avoir lu, compris et accepté le document. Ma signature électronique a la même valeur qu'une signature manuscrite.";
  const response = await fetch(`${url}/rest/v1/${signaturesTable}?id=eq.${encodeURIComponent(signatureId)}&client_id=eq.${encodeURIComponent(client.id)}`, {
    method: "PATCH",
    headers: { ...headers(key), Prefer: "return=representation" },
    body: JSON.stringify({
      signature_text: signatureText,
      consent_text: consentText,
      ip_address: ip,
      user_agent: userAgent,
      signed_at: new Date().toISOString(),
      status: "signed",
    }),
  });
  if (!response.ok) await supabaseError("Signature document", response);
  const signature = ((await response.json()) as ClientSignature[])[0];

  await updateClient(client.id, clientToInput(client, `Document signé électroniquement: ${signature.document_label}.`));
  await notifyClient(
    client,
    "Accès Canada - signature confirmée",
    `Bonjour ${client.full_name},

Votre signature électronique a bien été enregistrée.

Document: ${signature.document_label}
Référence: ${client.file_reference || "à confirmer"}

Accès Canada`,
  ).catch((error) => console.error("Notification signature confirmée non envoyée:", error));

  return signature;
}

export async function listClientPayments(clientId: string) {
  const { url, key, paymentsTable } = config();
  const response = await fetch(
    `${url}/rest/v1/${paymentsTable}?client_id=eq.${encodeURIComponent(clientId)}&select=*&order=created_at.desc`,
    { headers: headers(key), cache: "no-store" },
  );
  if (!response.ok) await supabaseError("Liste paiements", response);
  return (await response.json()) as ClientPayment[];
}

export async function createPaymentCheckout(client: AdminClient, amountCents: number, description: string) {
  const { url, key, paymentsTable, stripeSecretKey, siteUrl } = config();
  if (!stripeSecretKey) throw new Error("STRIPE_SECRET_KEY est manquant.");
  assertStripeKeyForEnvironment(stripeSecretKey);

  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", `${siteUrl}/client/dashboard?payment=success`);
  params.set("cancel_url", `${siteUrl}/client/dashboard?payment=cancelled`);
  params.set("customer_email", client.email);
  params.set("client_reference_id", client.id);
  params.set("metadata[client_id]", client.id);
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price_data][currency]", "usd");
  params.set("line_items[0][price_data][unit_amount]", String(amountCents));
  params.set("line_items[0][price_data][product_data][name]", description);

  const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  const stripeSession = (await stripeResponse.json()) as { id?: string; url?: string; payment_intent?: string; error?: { message?: string } };
  if (!stripeResponse.ok || !stripeSession.id || !stripeSession.url) {
    throw new Error(stripeSession.error?.message || "Création de session Stripe impossible.");
  }

  const paymentResponse = await fetch(`${url}/rest/v1/${paymentsTable}`, {
    method: "POST",
    headers: { ...headers(key), Prefer: "return=representation" },
    body: JSON.stringify({
      client_id: client.id,
      amount_cents: amountCents,
      currency: "usd",
      description,
      status: "pending",
      stripe_session_id: stripeSession.id,
      stripe_payment_intent: stripeSession.payment_intent || null,
      checkout_url: stripeSession.url,
    }),
  });
  if (!paymentResponse.ok) await supabaseError("Création paiement", paymentResponse);

  await updateClient(client.id, clientToInput(client, `Lien de paiement créé: ${formatUsd(amountCents / 100)}.`));
  return ((await paymentResponse.json()) as ClientPayment[])[0];
}

export async function markPaymentPaid(stripeSessionId: string, paymentIntent?: string | null) {
  const { url, key, paymentsTable } = config();
  const paymentResponse = await fetch(`${url}/rest/v1/${paymentsTable}?stripe_session_id=eq.${encodeURIComponent(stripeSessionId)}&select=*&limit=1`, {
    headers: headers(key),
    cache: "no-store",
  });
  if (!paymentResponse.ok) await supabaseError("Lecture paiement", paymentResponse);
  const payment = ((await paymentResponse.json()) as ClientPayment[])[0];
  if (!payment) return null;

  const patchResponse = await fetch(`${url}/rest/v1/${paymentsTable}?id=eq.${encodeURIComponent(payment.id)}`, {
    method: "PATCH",
    headers: { ...headers(key), Prefer: "return=representation" },
    body: JSON.stringify({
      status: "paid",
      paid_at: new Date().toISOString(),
      stripe_payment_intent: paymentIntent || payment.stripe_payment_intent,
    }),
  });
  if (!patchResponse.ok) await supabaseError("Confirmation paiement", patchResponse);
  const updated = ((await patchResponse.json()) as ClientPayment[])[0];

  const client = await getClient(updated.client_id);
  if (client) {
    await updateClient(client.id, {
      ...clientToInput(client, `Paiement reçu: ${formatUsd(updated.amount_cents / 100)}.`),
      paid_amount: Number(client.paid_amount || 0) + updated.amount_cents / 100,
    });
    await notifyClient(
      client,
      "Accès Canada - paiement reçu",
      `Bonjour ${client.full_name},

Votre paiement de ${formatUsd(updated.amount_cents / 100)} a bien été reçu.

Merci pour votre confiance.

Accès Canada`,
    ).catch((error) => console.error("Notification paiement non envoyée:", error));
  }

  return updated;
}

export async function listAllClientPayments() {
  const { url, key, paymentsTable } = config();
  const response = await fetch(`${url}/rest/v1/${paymentsTable}?select=*&order=created_at.desc`, {
    headers: headers(key), cache: "no-store",
  });
  if (!response.ok) await supabaseError("Liste globale paiements", response);
  return (await response.json()) as ClientPayment[];
}
