import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getClient } from "@/lib/admin-data";
import { documentFileName, generateClientPdf, isClientDocumentType } from "@/lib/pdf-documents";
import { getDecryptedQuestionnaires } from "@/lib/questionnaires";
import { getDocumentSignatureConfig } from "@/lib/signature-settings";

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

  const [questionnaires,signatures] = await Promise.all([getDecryptedQuestionnaires(client.id),getDocumentSignatureConfig()]);
  const data = Object.fromEntries(questionnaires.map(({ row, answers }) => [row.questionnaire_type === "client_principal" ? "client" : "guarantor", answers]));
  const pdf = generateClientPdf(client, type, {}, data, {}, signatures);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${documentFileName(client, type)}"`,
      "Cache-Control": "no-store",
    },
  });
}
