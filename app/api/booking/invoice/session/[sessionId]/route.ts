import { NextResponse } from "next/server";
import { generateAppointmentInvoicePdf, getAppointmentByStripeSession } from "@/lib/booking";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const appointment = await getAppointmentByStripeSession(sessionId).catch(() => null);
  if (!appointment) {
    return NextResponse.json({ message: "La facture sera disponible dès la confirmation Stripe finalisée." }, { status: 404 });
  }

  const pdf = generateAppointmentInvoicePdf(appointment);
  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${appointment.invoice_number}.pdf"`,
    },
  });
}
