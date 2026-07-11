import { NextResponse } from "next/server";
import { createAppointmentCheckout } from "@/lib/booking";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const checkout = await createAppointmentCheckout(body);
    return NextResponse.json(checkout);
  } catch (error) {
    console.error("Erreur paiement rendez-vous:", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Impossible de créer le paiement sécurisé." },
      { status: 400 },
    );
  }
}
