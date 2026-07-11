import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getClient } from "@/lib/admin-data";
import { documentFileName, generateClientPdf, isClientDocumentType } from "@/lib/pdf-documents";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string; type: string }>;
};

export async function GET(_request: Request, context: Context) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }

  const { id, type } = await context.params;

  if (!isClientDocumentType(type)) {
    return NextResponse.json({ message: "Type de document invalide." }, { status: 400 });
  }

  const client = await getClient(id).catch(() => null);
  if (!client) {
    return NextResponse.json({ message: "Client introuvable." }, { status: 404 });
  }

  const pdf = generateClientPdf(client, type);

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${documentFileName(client, type)}"`,
      "Cache-Control": "no-store",
    },
  });
}
