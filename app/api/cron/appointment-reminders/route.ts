import { NextResponse } from "next/server";
import { listAppointments, sendAppointmentReminderEmail } from "@/lib/booking";
import { isCronAuthorized } from "@/lib/appointment-reminders";
import { finishReminderDelivery,getAppointmentAutomationSettings,reserveReminderDelivery } from "@/lib/appointment-automation";
import { remindersDue } from "@/lib/appointment-reminder-schedule";

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
    const settings=await getAppointmentAutomationSettings();
    const appointments=await listAppointments({status:"confirmed"});
    const due=remindersDue(appointments,settings.email_enabled?settings.reminder_offsets_hours:[]);
    let sent=0,failed=0;
    for(const item of due){if(!(await reserveReminderDelivery(item.appointment.id,item.offsetHours)))continue;try{await sendAppointmentReminderEmail(item.appointment);await finishReminderDelivery(item.appointment.id,item.offsetHours);sent++;}catch(error){await finishReminderDelivery(item.appointment.id,item.offsetHours,error);failed++;}}
    const result={candidates:due.length,sent,failed};
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
