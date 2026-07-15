import { NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { getClient } from "@/lib/admin-data";
import { getGeneratedDocument } from "@/lib/admin-documents";
import { generateClientPdf } from "@/lib/pdf-documents";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: Context) {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ message: "Non autorisé." }, { status: 401 });

  const { id } = await context.params;
  const document = await getGeneratedDocument(id).catch(() => null);
  if (!document || document.client_id !== session.clientId) {
    return NextResponse.json({ message: "Document introuvable." }, { status: 404 });
  }

  const client = await getClient(session.clientId).catch(() => null);
  if (!client) return NextResponse.json({ message: "Client introuvable." }, { status: 404 });

  const pdf = generateClientPdf(client, document.document_type, document.included_information || {});
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${document.file_name}"`,
      "Cache-Control": "no-store",
    },
  });
}
