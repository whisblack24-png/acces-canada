import { NextResponse } from "next/server";
import { generateAppointmentInvoicePdf, getAppointmentByStripeSession } from "@/lib/booking";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  let appointment;
  try {
    appointment = await getAppointmentByStripeSession(sessionId);
  } catch (error) {
    console.error("[booking-invoice]", JSON.stringify({
      stage: "lookup_failed",
      sessionId,
      message: error instanceof Error ? error.message : "Erreur inconnue",
    }));
    return NextResponse.json({ message: "Impossible de vérifier la facture pour le moment." }, { status: 500 });
  }
  if (!appointment) {
    return NextResponse.json({ message: "La facture sera disponible dès la confirmation Stripe finalisée." }, { status: 404 });
  }

  const pdf = generateAppointmentInvoicePdf(appointment);
  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${appointment.invoice_number}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
