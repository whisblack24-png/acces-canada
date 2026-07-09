import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { adminDocumentErrorMessage, deleteGeneratedDocument, logDocumentError } from "@/lib/admin-documents";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: Request, context: Context) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "Non autorise." }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    await deleteGeneratedDocument(id);
    return NextResponse.json({ message: "Document supprime." });
  } catch (error) {
    logDocumentError("Erreur suppression document", error);
    return NextResponse.json({ message: `Impossible de supprimer le document. ${adminDocumentErrorMessage(error)}` }, { status: 500 });
  }
}
