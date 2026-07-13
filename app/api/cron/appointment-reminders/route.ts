import { NextResponse } from "next/server";
import { listAppointments, sendAppointmentReminderEmail } from "@/lib/booking";
import { isCronAuthorized, runAppointmentReminders } from "@/lib/appointment-reminders";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const startedAt = Date.now();
  const secret = process.env.CRON_SECRET;
  if (!isCronAuthorized(secret, request.headers.get("authorization"))) {
    console.warn("[appointment-reminders] unauthorized", {
      requestId: request.headers.get("x-vercel-id"),
      secretConfigured: Boolean(secret),
    });
    return NextResponse.json({ message: "Accès non autorisé." }, { status: 401 });
  }

  try {
    const result = await runAppointmentReminders({
      listConfirmedAppointments: () => listAppointments({ status: "confirmed" }),
      sendReminder: sendAppointmentReminderEmail,
    });
    console.info("[appointment-reminders] completed", {
      ...result,
      durationMs: Date.now() - startedAt,
      requestId: request.headers.get("x-vercel-id"),
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[appointment-reminders] failed", {
      message: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startedAt,
      requestId: request.headers.get("x-vercel-id"),
    });
    return NextResponse.json({ message: "Échec du traitement des rappels." }, { status: 500 });
  }
}
