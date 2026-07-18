import { NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { getClient } from "@/lib/admin-data";
import { getGeneratedDocument } from "@/lib/admin-documents";
import { generateClientPdf } from "@/lib/pdf-documents";
import { getDocumentSignatureConfig } from "@/lib/signature-settings";
import { assertDownloadableFile, downloadHeaders } from "@/lib/file-download";

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

  const signatures=await getDocumentSignatureConfig();
  const pdf = generateClientPdf(client, document.document_type, { ...(document.included_information || {}), includeSignatures: true }, {}, { documentNumber: document.document_number, verificationToken: document.verification_token, authenticityHash: document.authenticity_hash, version: document.version, status: document.status, createdAt: document.issued_at || document.created_at, digitallySigned: true }, signatures);
  try{assertDownloadableFile(pdf,document.file_name);}catch(error){return NextResponse.json({message:error instanceof Error?error.message:"PDF invalide."},{status:500});}
  const headers=downloadHeaders(document.file_name,"application/pdf");headers["Content-Length"]=String(pdf.length);
  return new Response(new Uint8Array(pdf),{headers});
}
