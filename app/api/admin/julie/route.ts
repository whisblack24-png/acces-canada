import { NextResponse } from "next/server";
import { getAdminIdentity, isAdminAuthenticated } from "@/lib/admin-auth";
import { executeJulieCommand } from "@/lib/julie-agent";
import { getJulieConversation, listJulieMessages, saveJulieMessage, setJulieConversationClient } from "@/lib/julie";

export async function GET() {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const identity = await getAdminIdentity();
  if (!identity?.id) return NextResponse.json({ error: "Identité introuvable." }, { status: 401 });
  const conversation = await getJulieConversation(identity.id);
  return NextResponse.json({ conversationId: conversation.id, messages: await listJulieMessages(conversation.id) });
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const body = await request.json() as { message?: string; clientId?: string };
  const message = String(body.message || "").trim().slice(0, 4000);
  if (!message) return NextResponse.json({ error: "Écrivez une demande à Julie." }, { status: 400 });
  try {
    const identity = await getAdminIdentity();
    if (!identity?.id) return NextResponse.json({ error: "Identité introuvable." }, { status: 401 });
    const conversation = await getJulieConversation(identity.id);
    const history = await listJulieMessages(conversation.id);
    await saveJulieMessage(conversation.id, "staff", message);
    const execution = await executeJulieCommand(message, body.clientId, history);
    if (execution.action !== "create_client" || execution.clientIds.length) await setJulieConversationClient(conversation.id, execution.clientIds[0]);
    await saveJulieMessage(conversation.id, "julie", execution.answer);
    return NextResponse.json({ ...execution, conversationId: conversation.id });
  } catch (error) {
    console.error("Julie", error);
    return NextResponse.json({ error: "Julie n’a pas pu traiter cette demande. Aucune action incomplète n’a été présentée comme réussie." }, { status: 500 });
  }
}
