import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { createClientMessage, listClientMessages } from "@/lib/client-portal";
import { getClient, updateClient } from "@/lib/admin-data";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  const { id } = await params;
  return NextResponse.json({ messages: await listClientMessages(id) });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  try {
    const { id } = await params;
    const payload = (await request.json()) as { body?: string };
    const message = await createClientMessage(id, "admin", String(payload.body || ""));
    const client = await getClient(id);
    if (client) {
      await updateClient(id, {
        ...client,
        phone: client.phone || undefined, country: client.country || undefined, file_reference: client.file_reference || undefined,
        notes: client.notes || undefined, public_notes: client.public_notes || undefined, internal_notes: client.internal_notes || undefined,
        documents_received: client.documents_received || [], documents_missing: client.documents_missing || [],
        action_history: [...(client.action_history || []), { date: new Date().toISOString(), action: "Message sécurisé envoyé au client." }].slice(-100),
      });
    }
    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Envoi impossible." }, { status: 400 });
  }
}
