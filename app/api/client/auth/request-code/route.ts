import { NextResponse } from "next/server";
import { createClientCode } from "@/lib/client-auth";
import { createLoginCode, findClientByEmail } from "@/lib/client-portal";
import { sendSmtpMail } from "@/lib/smtp";
import { brand } from "@/lib/site";

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
    secure: process.env.SMTP_SECURE === "true" || smtpPort === 465,
    startTls: process.env.SMTP_STARTTLS !== "false",
    user: smtpUser,
    pass: smtpPass,
    from: smtpFrom,
    to: email,
    replyTo: brand.email,
    subject: "Acces Canada - code d'acces client",
    text: [
      `Bonjour ${name},`,
      "",
      "Voici votre code temporaire pour acceder a votre espace client Acces Canada :",
      "",
      code,
      "",
      "Ce code expire dans 10 minutes.",
      "",
      "Acces Canada",
      "Votre chemin vers le Canada, notre engagement.",
    ].join("\n"),
  });
}

export async function POST(request: Request) {
  try {
    const { email } = (await request.json()) as { email?: string };
    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return NextResponse.json({ message: "Adresse courriel invalide." }, { status: 400 });
    }

    const client = await findClientByEmail(cleanEmail);
    if (!client) {
      return NextResponse.json({ message: "Aucun dossier client n'est associe a ce courriel." }, { status: 404 });
    }

    const code = createClientCode();
    await createLoginCode(client.id, client.email, code);
    await sendCode(client.email, client.full_name, code);

    return NextResponse.json({ message: "Un code d'acces vient d'etre envoye a votre courriel." });
  } catch (error) {
    console.error("Erreur demande code client:", error);
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Variable d'environnement manquante")) {
      return NextResponse.json({ message }, { status: 500 });
    }

    if (/SMTP|AUTH|535|534|Username|Password|credentials|authentication/i.test(message)) {
      return NextResponse.json(
        { message: "Impossible d'envoyer le code : Gmail/SMTP a refuse la connexion. Verifiez SMTP_USER et SMTP_PASS." },
        { status: 500 },
      );
    }

    return NextResponse.json({ message: "Impossible d'envoyer le code pour le moment. Verifiez la configuration Gmail SMTP." }, { status: 500 });
  }
}
