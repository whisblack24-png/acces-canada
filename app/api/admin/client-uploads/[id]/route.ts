import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { deleteClientFile, renameClientUpload } from "@/lib/client-portal";
import { reconcileClientDocumentState } from "@/lib/document-state";

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
    await reconcileClientDocumentState(clientId);
    return NextResponse.json({ message: "Document supprime." });
  } catch (error) {
    console.error("Erreur suppression document client:", error);
    return NextResponse.json({ message: "Impossible de supprimer le document client." }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: Context) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  const { id } = await context.params; const clientId = new URL(request.url).searchParams.get("clientId");
  const body = await request.json() as { file_name?: string }; const fileName = String(body.file_name || "").trim().slice(0,240);
  if (!clientId || !fileName) return NextResponse.json({ message: "Nom et client requis." }, { status: 400 });
  try { return NextResponse.json({ upload: await renameClientUpload(clientId,id,fileName) }); }
  catch (error) { console.error("Renommage document client:",error); return NextResponse.json({ message: "Impossible de renommer le document." }, { status: 500 }); }
}
