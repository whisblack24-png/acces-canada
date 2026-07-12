import { NextResponse } from "next/server";
import { sendSmtpMail } from "@/lib/smtp";

export const runtime = "nodejs";
export const maxDuration = 60;

const DIAGNOSTIC_TOKEN = "1f58bf5e-9375-4638-9731-96f207d055e7";

export async function POST(request: Request) {
  if (request.headers.get("x-diagnostic-token") !== DIAGNOSTIC_TOKEN) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

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
  ].filter(([, value]) => !value).map(([name]) => name);

  if (missing.length) {
    return NextResponse.json({ ok: false, stage: "configuration", missing }, { status: 500 });
  }

  try {
    console.info("[smtp-diagnostic] start", { host, port, secure: process.env.SMTP_SECURE, startTls: process.env.SMTP_STARTTLS });
    await sendSmtpMail({
      host: host!,
      port,
      secure: String(process.env.SMTP_SECURE || "true") === "true",
      startTls: String(process.env.SMTP_STARTTLS || "false") === "true",
      user: user!,
      pass: pass!,
      from: from!,
      to: user!,
      subject: "Accès Canada - diagnostic SMTP",
      text: "Diagnostic automatique du transport Gmail avec pièce jointe.",
      attachments: [{
        filename: "diagnostic.pdf",
        contentType: "application/pdf",
        content: Buffer.from("%PDF-1.4\n% diagnostic Acces Canada\n%%EOF", "utf8"),
      }],
    });
    console.info("[smtp-diagnostic] accepted");
    return NextResponse.json({ ok: true, stage: "accepted" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    console.error("[smtp-diagnostic] failed", { message, cause: error instanceof Error ? error.cause : undefined });
    return NextResponse.json({ ok: false, stage: "smtp", message }, { status: 500 });
  }
}
