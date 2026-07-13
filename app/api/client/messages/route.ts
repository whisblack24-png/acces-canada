import { NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { createClientMessage, listClientMessages } from "@/lib/client-portal";

export async function GET() {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  return NextResponse.json({ messages: await listClientMessages(session.clientId) });
}

export async function POST(request: Request) {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  try {
    const payload = (await request.json()) as { body?: string };
    const message = await createClientMessage(session.clientId, "client", String(payload.body || ""));
    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Envoi impossible." }, { status: 400 });
  }
}
