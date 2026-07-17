import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { cancelAppointment, getAppointment, moveAppointment, sendAppointmentConfirmationEmail } from "@/lib/booking";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "Accès non autorisé." }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  try {
    if (body.action === "cancel") {
      const reason = typeof body.reason === "string" ? body.reason.trim() : "";
      if (!reason) return NextResponse.json({ message: "La raison de l’annulation est obligatoire." }, { status: 400 });
      return NextResponse.json({ appointment: await cancelAppointment(id, reason) });
    }

    if (body.action === "move") {
      return NextResponse.json({ appointment: await moveAppointment(id, body.startsAt) });
    }

    if (body.action === "resend") {
      const appointment = await getAppointment(id);
      if (!appointment) return NextResponse.json({ message: "Rendez-vous introuvable." }, { status: 404 });
      await sendAppointmentConfirmationEmail(appointment);
      return NextResponse.json({ appointment });
    }

    return NextResponse.json({ message: "Action invalide." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Action impossible." },
      { status: 400 },
    );
  }
}
