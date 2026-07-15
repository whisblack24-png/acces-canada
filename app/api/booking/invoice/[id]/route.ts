import { NextResponse } from "next/server";
import { getAppointment, generateAppointmentInvoicePdf } from "@/lib/booking";
import { getClientSession } from "@/lib/client-auth";
import { isAdminAuthenticated } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const appointment = await getAppointment(id).catch(() => null);
  if (!appointment) {
    return NextResponse.json({ message: "Facture introuvable." }, { status: 404 });
  }
  const [clientSession, adminSession] = await Promise.all([getClientSession(), isAdminAuthenticated()]);
  if (!adminSession && clientSession?.email.toLowerCase() !== appointment.client_email.toLowerCase()) {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }

  const pdf = generateAppointmentInvoicePdf(appointment);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${appointment.invoice_number}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
