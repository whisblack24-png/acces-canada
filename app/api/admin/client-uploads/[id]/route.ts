import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { deleteClientFile } from "@/lib/client-portal";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

export async function DELETE(request: Request, context: Context) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }

  const { id } = await context.params;
  const clientId = new URL(request.url).searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json({ message: "clientId requis." }, { status: 400 });
  }

  try {
    const deleted = await deleteClientFile(clientId, id);
    if (!deleted) return NextResponse.json({ message: "Document introuvable." }, { status: 404 });
    return NextResponse.json({ message: "Document supprime." });
  } catch (error) {
    console.error("Erreur suppression document client:", error);
    return NextResponse.json({ message: "Impossible de supprimer le document client." }, { status: 500 });
  }
}
