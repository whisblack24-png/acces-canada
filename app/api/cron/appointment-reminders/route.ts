import { NextResponse } from "next/server";
import { listAppointments, sendAppointmentReminderEmail } from "@/lib/booking";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ message: "Accès non autorisé." }, { status: 401 });
  }

  const now = Date.now();
  const from = now + 20 * 60 * 60 * 1000;
  const to = now + 28 * 60 * 60 * 1000;
  const appointments = (await listAppointments({ status: "confirmed" })).filter((appointment) => {
    const startsAt = new Date(appointment.starts_at).getTime();
    return startsAt >= from && startsAt < to;
  });

  const results = await Promise.allSettled(appointments.map(sendAppointmentReminderEmail));
  const sent = results.filter((result) => result.status === "fulfilled").length;
  const failed = results.length - sent;
  console.info("[appointment-reminders]", { candidates: appointments.length, sent, failed });
  return NextResponse.json({ candidates: appointments.length, sent, failed });
}
