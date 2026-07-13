import { NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { deleteClientFile } from "@/lib/client-portal";

export const runtime = "nodejs";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  try {
    const { id } = await params;
    const deleted = await deleteClientFile(session.clientId, id);
    if (!deleted) return NextResponse.json({ message: "Document introuvable." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erreur suppression document client:", error);
    return NextResponse.json({ message: "Impossible de supprimer le document." }, { status: 500 });
  }
}
