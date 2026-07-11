import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getClient } from "@/lib/admin-data";
import { createPaymentCheckout, listClientPayments } from "@/lib/production-workflow";

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
    return NextResponse.json({ payments: await listClientPayments(id) });
  } catch (error) {
    console.error("Erreur paiements admin:", error);
    return NextResponse.json({ message: "Impossible de charger les paiements." }, { status: 500 });
  }
}

export async function POST(request: Request, context: Context) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const { id } = await context.params;

  const client = await getClient(id).catch(() => null);
  if (!client) return NextResponse.json({ message: "Client introuvable." }, { status: 404 });

  try {
    const body = (await request.json()) as { amountCents?: number; description?: string };
    const amount = Number(body.amountCents || 0);
    if (!Number.isFinite(amount) || amount < 100) {
      return NextResponse.json({ message: "Montant invalide." }, { status: 400 });
    }

    const payment = await createPaymentCheckout(client, amount, String(body.description || "Paiement Accès Canada").slice(0, 180));
    return NextResponse.json({ payment }, { status: 201 });
  } catch (error) {
    console.error("Erreur paiement admin:", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "Impossible de créer le paiement." }, { status: 500 });
  }
}
