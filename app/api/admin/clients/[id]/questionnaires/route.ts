import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getClient } from "@/lib/admin-data";
import { questionnaireInvitationEmail } from "@/lib/questionnaire-email";
import { disableAccessLinks, generateAccessLink, getClientQuestionnaire, listQuestionnaires } from "@/lib/questionnaires";
import type { QuestionnaireType } from "@/lib/questionnaire-definitions";
import { sendSmtpMail, smtpSecurityForPort } from "@/lib/smtp";

function baseUrl(request: Request) { return (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, ""); }
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const { id } = await params; const body = await request.json() as { type: QuestionnaireType; operation: "generate" | "disable"; email?: boolean }; const row = await getClientQuestionnaire(id, body.type);
  if (!row) return NextResponse.json({ error: "Questionnaire introuvable." }, { status: 404 });
  try {
    if (body.operation === "disable") { await disableAccessLinks(row.id); return NextResponse.json({ rows: await listQuestionnaires(id), disabled: true }); }
    const client = await getClient(id); if (!client) throw new Error("Client introuvable.");
    const link = await generateAccessLink(row.id, { name: client.full_name, email: client.email }); const siteUrl = baseUrl(request); const url = `${siteUrl}/q/${link.token}`;
    if (body.email) {
      const host = process.env.SMTP_HOST, user = process.env.SMTP_USER, pass = process.env.SMTP_PASS; if (!host || !user || !pass || !client.email) throw new Error("Configuration SMTP ou courriel destinataire manquant.");
      const port = Number(process.env.SMTP_PORT || 587); const content = questionnaireInvitationEmail({ name: client.full_name, type: body.type, url, expiresAt: link.expiresAt, siteUrl });
      await sendSmtpMail({ host, port, ...smtpSecurityForPort(port), user, pass, from: process.env.SMTP_FROM || user, to: client.email, subject: "Accès Canada · Votre questionnaire sécurisé", text: content.text, html: content.html, replyTo: process.env.SMTP_REPLY_TO || process.env.SMTP_FROM || user });
    }
    return NextResponse.json({ url, expiresAt: link.expiresAt, recipientEmail: client.email, rows: await listQuestionnaires(id) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur." }, { status: 400 }); }
}
