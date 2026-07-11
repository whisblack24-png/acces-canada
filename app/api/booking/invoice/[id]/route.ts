import { NextResponse } from "next/server";
import { getAppointment, generateAppointmentInvoicePdf } from "@/lib/booking";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const appointment = await getAppointment(id).catch(() => null);
  if (!appointment) {
    return NextResponse.json({ message: "Facture introuvable." }, { status: 404 });
  }

  const pdf = generateAppointmentInvoicePdf(appointment);
  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${appointment.invoice_number}.pdf"`,
    },
  });
}
