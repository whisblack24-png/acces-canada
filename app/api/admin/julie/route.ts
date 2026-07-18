import { NextResponse } from "next/server";
import { getAdminIdentity, isAdminAuthenticated } from "@/lib/admin-auth";
import { executeJulieCommand } from "@/lib/julie-agent";
import { getJulieConversation, listJulieMessages, saveJulieMessage, setJulieConversationClient, setJulieConversationMode } from "@/lib/julie";

export async function GET() {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const identity = await getAdminIdentity();
  if (!identity?.id) return NextResponse.json({ error: "Identité introuvable." }, { status: 401 });
  const conversation = await getJulieConversation(identity.id);
  return NextResponse.json({ conversationId: conversation.id, clientId: conversation.client_id, executionMode: conversation.execution_mode || "automatic", messages: await listJulieMessages(conversation.id) });
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const body = await request.json() as { message?: string; clientId?: string; executionMode?: "automatic"|"approval_all" };
  const message = String(body.message || "").trim().slice(0, 30000);
  if (!message) return NextResponse.json({ error: "Écrivez une demande à Julie." }, { status: 400 });
  try {
    const identity = await getAdminIdentity();
    if (!identity?.id) return NextResponse.json({ error: "Identité introuvable." }, { status: 401 });
    const conversation = await getJulieConversation(identity.id);
    const history = await listJulieMessages(conversation.id);
    const activeClientId = body.clientId && body.clientId !== "auto" ? body.clientId : conversation.client_id || undefined;
    if (body.executionMode && body.executionMode !== conversation.execution_mode) await setJulieConversationMode(conversation.id, body.executionMode);
    await saveJulieMessage(conversation.id, "staff", message);
    const mode=body.executionMode||conversation.execution_mode||"automatic";
    const execution = await executeJulieCommand(message, activeClientId, history, mode);
    if (execution.action !== "create_client" || execution.clientIds.length) await setJulieConversationClient(conversation.id, execution.clientIds[0]);
    await saveJulieMessage(conversation.id, "julie", execution.answer);
    return NextResponse.json({ ...execution, conversationId: conversation.id });
  } catch (error) {
    console.error("Julie", error);
    return NextResponse.json({ error: "Julie n’a pas pu traiter cette demande. Aucune action incomplète n’a été présentée comme réussie." }, { status: 500 });
  }
}
