import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getClient } from "@/lib/admin-data";
import { getGeneratedDocument } from "@/lib/admin-documents";
import { generateClientPdf } from "@/lib/pdf-documents";
import { getDecryptedQuestionnaires } from "@/lib/questionnaires";
import { getDocumentSignatureConfig } from "@/lib/signature-settings";
import { assertDownloadableFile, downloadHeaders } from "@/lib/file-download";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: Context) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }

  const { id } = await context.params;
  const document = await getGeneratedDocument(id).catch(() => null);
  if (!document) {
    return NextResponse.json({ message: "Document introuvable." }, { status: 404 });
  }

  const client = await getClient(document.client_id).catch(() => null);
  if (!client) {
    return NextResponse.json({ message: "Client associe introuvable." }, { status: 404 });
  }

  const [questionnaires,signatures] = await Promise.all([getDecryptedQuestionnaires(client.id),getDocumentSignatureConfig()]);
  const data = Object.fromEntries(questionnaires.map(({ row, answers }) => [row.questionnaire_type === "client_principal" ? "client" : "guarantor", answers]));
  const pdf = generateClientPdf(client, document.document_type, { ...(document.included_information || {}), includeSignatures: true }, data, { documentNumber: document.document_number, verificationToken: document.verification_token, authenticityHash: document.authenticity_hash, version: document.version, status: document.status, createdAt: document.issued_at || document.created_at, digitallySigned: true }, signatures);
  try{assertDownloadableFile(pdf,document.file_name);}catch(error){return NextResponse.json({message:error instanceof Error?error.message:"PDF invalide."},{status:500});}
  const headers=downloadHeaders(document.file_name,"application/pdf");headers["Content-Length"]=String(pdf.length);

  return new Response(new Uint8Array(pdf),{headers});
}
