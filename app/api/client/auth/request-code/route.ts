import { NextResponse } from "next/server";
import { createClientCode } from "@/lib/client-auth";
import { createLoginCode, findClientByEmail } from "@/lib/client-portal";
import { sendSmtpMail, smtpSecurityForPort } from "@/lib/smtp";
import { brand } from "@/lib/site";
import { checkRateLimit, requestIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variable d'environnement manquante: ${name}`);
  return value;
}

async function sendCode(email: string, name: string, code: string) {
  const smtpHost = requiredEnv("SMTP_HOST");
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = requiredEnv("SMTP_USER");
  const smtpPass = requiredEnv("SMTP_PASS");
  const smtpFrom = process.env.SMTP_FROM?.trim() || smtpUser;

  await sendSmtpMail({
    host: smtpHost,
    port: smtpPort,
    ...smtpSecurityForPort(smtpPort),
    startTls: process.env.SMTP_STARTTLS !== "false",
    user: smtpUser,
    pass: smtpPass,
    from: smtpFrom,
    to: email,
    replyTo: brand.email,
    subject: "Accès Canada - code d'accès client",
    text: [
      `Bonjour ${name},`,
      "",
      "Voici votre code temporaire pour accéder à votre espace client Accès Canada :",
      "",
      code,
      "",
      "Ce code expire dans 10 minutes.",
      "",
      "Accès Canada",
      "Votre chemin vers le Canada, notre engagement.",
    ].join("\n"),
  });
}

function canShowDevCode() {
  return process.env.NODE_ENV !== "production" || process.env.CLIENT_DEV_EMAIL_FALLBACK === "true";
}

export async function POST(request: Request) {
  try {
    const rate = checkRateLimit(`client-code:${requestIp(request)}`, 5, 15 * 60 * 1000);
    if (!rate.allowed) return NextResponse.json({ message: "Trop de demandes. Réessayez dans quelques minutes." }, { status: 429, headers: { "Retry-After": String(rate.retryAfter) } });
    const { email } = (await request.json()) as { email?: string };
    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return NextResponse.json({ message: "Adresse courriel invalide." }, { status: 400 });
    }

    const client = await findClientByEmail(cleanEmail);
    if (!client) {
      return NextResponse.json({ message: "Si un dossier correspond à cette adresse, un code d’accès vient d’être envoyé." });
    }

    const code = createClientCode();
    await createLoginCode(client.id, client.email, code);

    try {
      await sendCode(client.email, client.full_name, code);
    } catch (emailError) {
      if (!canShowDevCode()) {
        throw emailError;
      }

      console.error("Erreur envoi code client Gmail en développement:", emailError);
      console.log(`CODE CLIENT DEV: ${code} (${client.email})`);

      return NextResponse.json({
        message:
          "Code créé dans Supabase. En mode développement, Gmail est bloqué localement; consultez le terminal pour CODE CLIENT DEV.",
      });
    }

    return NextResponse.json({ message: "Si un dossier correspond à cette adresse, un code d’accès vient d’être envoyé." });
  } catch (error) {
    console.error("Erreur demande code client:", error);
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Variable d'environnement manquante")) {
      return NextResponse.json({ message }, { status: 500 });
    }

    if (/SMTP|AUTH|535|534|Username|Password|credentials|authentication/i.test(message)) {
      return NextResponse.json(
        { message: "Impossible d'envoyer le code : Gmail/SMTP a refusé la connexion. Vérifiez SMTP_USER et SMTP_PASS." },
        { status: 500 },
      );
    }

    return NextResponse.json({ message: "Impossible d'envoyer le code pour le moment. Vérifiez la configuration Gmail SMTP." }, { status: 500 });
  }
}
