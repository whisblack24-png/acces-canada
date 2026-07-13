import { NextResponse } from "next/server";
import { getAppointmentByStripeSession } from "@/lib/booking";
import { consultationModeLabels, consultationTypes } from "@/lib/booking-shared";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  if (!sessionId.startsWith("cs_")) {
    return NextResponse.json({ status: "invalid", message: "Session Stripe invalide." }, { status: 400 });
  }

  try {
    const appointment = await getAppointmentByStripeSession(sessionId);
    if (!appointment) {
      return NextResponse.json({ status: "pending" }, { headers: { "Cache-Control": "no-store" } });
    }

    return NextResponse.json(
      {
        status: "confirmed",
        bookingReference: appointment.booking_reference,
        invoiceNumber: appointment.invoice_number,
        startsAt: appointment.starts_at,
        consultationLabel: consultationTypes[appointment.consultation_type].label,
        consultationMode: consultationModeLabels[appointment.consultation_mode],
        durationMinutes: appointment.duration_minutes,
        amountCents: appointment.amount_cents,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[booking-status]", JSON.stringify({
      sessionId,
      message: error instanceof Error ? error.message : "Erreur inconnue",
    }));
    return NextResponse.json({ status: "error", message: "Impossible de vérifier le rendez-vous." }, { status: 500 });
  }
}
