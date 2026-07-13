type ReminderAppointment = {
  starts_at: string;
};

type ReminderDependencies<T extends ReminderAppointment> = {
  listConfirmedAppointments: () => Promise<T[]>;
  sendReminder: (appointment: T) => Promise<void>;
};

export type ReminderRunResult = {
  candidates: number;
  sent: number;
  failed: number;
};

export function isCronAuthorized(secret: string | undefined, authorization: string | null) {
  return Boolean(secret && authorization === `Bearer ${secret}`);
}

export async function runAppointmentReminders<T extends ReminderAppointment>(
  dependencies: ReminderDependencies<T>,
  now = Date.now(),
): Promise<ReminderRunResult> {
  const from = now + 20 * 60 * 60 * 1000;
  const to = now + 28 * 60 * 60 * 1000;
  const appointments = (await dependencies.listConfirmedAppointments()).filter((appointment) => {
    const startsAt = new Date(appointment.starts_at).getTime();
    return startsAt >= from && startsAt < to;
  });

  const results = await Promise.allSettled(appointments.map(dependencies.sendReminder));
  const sent = results.filter((result) => result.status === "fulfilled").length;
  return { candidates: appointments.length, sent, failed: results.length - sent };
}
