import { NextResponse } from "next/server";
import { getClient } from "@/lib/admin-data";
import { getClientSession } from "@/lib/client-auth";
import { listClientSignatures, signDocument } from "@/lib/production-workflow";

export const runtime = "nodejs";

export async function GET() {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ message: "Non autorisé." }, { status: 401 });

  try {
    return NextResponse.json({ signatures: await listClientSignatures(session.clientId) });
  } catch (error) {
    console.error("Erreur signatures client:", error);
    return NextResponse.json({ message: "Impossible de charger les documents à signer." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ message: "Non autorisé." }, { status: 401 });

  const client = await getClient(session.clientId).catch(() => null);
  if (!client) return NextResponse.json({ message: "Client introuvable." }, { status: 404 });

  try {
    const { signatureId, signatureText } = (await request.json()) as { signatureId?: string; signatureText?: string };
    const cleanSignature = String(signatureText || "").trim().slice(0, 180);
    if (!signatureId || cleanSignature.length < 2) {
      return NextResponse.json({ message: "Signature invalide." }, { status: 400 });
    }

    return NextResponse.json({ signature: await signDocument(signatureId, client, cleanSignature, request) });
  } catch (error) {
    console.error("Erreur signature client:", error);
    return NextResponse.json({ message: "Impossible d'enregistrer la signature." }, { status: 500 });
  }
}
