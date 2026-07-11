import { NextResponse } from "next/server";
import { getClient } from "@/lib/admin-data";
import { getClientSession } from "@/lib/client-auth";
import { createPaymentCheckout, listClientPayments } from "@/lib/production-workflow";

export const runtime = "nodejs";

export async function GET() {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ message: "Non autorisé." }, { status: 401 });

  try {
    return NextResponse.json({ payments: await listClientPayments(session.clientId) });
  } catch (error) {
    console.error("Erreur paiements client:", error);
    return NextResponse.json({ message: "Impossible de charger les paiements." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ message: "Non autorisé." }, { status: 401 });

  const client = await getClient(session.clientId).catch(() => null);
  if (!client) return NextResponse.json({ message: "Client introuvable." }, { status: 404 });

  try {
    const { amountCents, description } = (await request.json()) as { amountCents?: number; description?: string };
    const amount = Number(amountCents || 0);
    if (!Number.isFinite(amount) || amount < 100) {
      return NextResponse.json({ message: "Montant invalide." }, { status: 400 });
    }

    const payment = await createPaymentCheckout(client, amount, String(description || "Paiement Accès Canada").slice(0, 180));
    return NextResponse.json({ payment });
  } catch (error) {
    console.error("Erreur checkout Stripe:", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "Paiement impossible." }, { status: 500 });
  }
}
