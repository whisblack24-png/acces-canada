import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getClient, updateClient } from "@/lib/admin-data";
import {
  adminDocumentErrorMessage,
  createGeneratedDocument,
  listGeneratedDocuments,
  logDocumentError,
} from "@/lib/admin-documents";
import { documentFileName, isClientDocumentType } from "@/lib/pdf-documents";
import type { DocumentGenerationOptions } from "@/lib/pdf-documents";

export const runtime = "nodejs";

async function requireAdmin() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }

  return null;
}

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    return NextResponse.json({ documents: await listGeneratedDocuments() });
  } catch (error) {
    logDocumentError("Erreur liste documents", error);
    return NextResponse.json({ message: `Impossible de charger les documents. ${adminDocumentErrorMessage(error)}` }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const body = (await request.json()) as {
    client_id?: string;
    document_type?: string;
    included_information?: DocumentGenerationOptions;
  };

  if (!body.client_id || !body.document_type || !isClientDocumentType(body.document_type)) {
    return NextResponse.json({ message: "Client ou type de document invalide." }, { status: 400 });
  }

  const client = await getClient(body.client_id).catch(() => null);
  if (!client) {
    return NextResponse.json({ message: "Client introuvable." }, { status: 404 });
  }

  try {
    const document = await createGeneratedDocument({
      client_id: client.id,
      client_name: client.full_name,
      document_type: body.document_type,
      file_name: documentFileName(client, body.document_type),
      included_information: { ...(body.included_information || {}), includeSignatures: true },
    });

    await updateClient(client.id, {
      full_name: client.full_name,
      email: client.email,
      phone: client.phone || undefined,
      country: client.country || undefined,
      service: client.service,
      status: client.status,
      file_reference: client.file_reference || undefined,
      notes: client.notes || undefined,
      public_notes: client.public_notes || undefined,
      internal_notes: client.internal_notes || undefined,
      documents_received: client.documents_received || [],
      documents_missing: client.documents_missing || [],
      paid_amount: Number(client.paid_amount || 0),
      action_history: [
        ...(client.action_history || []),
        { date: new Date().toISOString(), action: `Document généré: ${document.document_label}.` },
      ].slice(-100),
    }).catch((error) => console.error("Historique du document non mis à jour:", error));

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    logDocumentError("Erreur creation document", error);
    return NextResponse.json({ message: `Impossible de générer le document. ${adminDocumentErrorMessage(error)}` }, { status: 500 });
  }
}
