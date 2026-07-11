import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getClient } from "@/lib/admin-data";
import { isClientDocumentType } from "@/lib/pdf-documents";
import { listClientSignatures, requestSignature } from "@/lib/production-workflow";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

async function requireAdmin() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }
  return null;
}

export async function GET(_request: Request, context: Context) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const { id } = await context.params;

  try {
    return NextResponse.json({ signatures: await listClientSignatures(id) });
  } catch (error) {
    console.error("Erreur signatures admin:", error);
    return NextResponse.json({ message: "Impossible de charger les signatures." }, { status: 500 });
  }
}

export async function POST(request: Request, context: Context) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const { id } = await context.params;

  const client = await getClient(id).catch(() => null);
  if (!client) return NextResponse.json({ message: "Client introuvable." }, { status: 404 });

  try {
    const body = (await request.json()) as { documentType?: string; documentId?: string };
    if (!body.documentType || !isClientDocumentType(body.documentType)) {
      return NextResponse.json({ message: "Type de document invalide." }, { status: 400 });
    }
    return NextResponse.json({ signature: await requestSignature(client, body.documentType, body.documentId || null) }, { status: 201 });
  } catch (error) {
    console.error("Erreur demande signature:", error);
    return NextResponse.json({ message: "Impossible de demander la signature." }, { status: 500 });
  }
}
