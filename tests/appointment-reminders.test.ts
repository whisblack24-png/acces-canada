import assert from "node:assert/strict";
import test from "node:test";
import { isCronAuthorized, runAppointmentReminders } from "../lib/appointment-reminders.ts";

test("le cron refuse un secret absent ou incorrect", () => {
  assert.equal(isCronAuthorized(undefined, null), false);
  assert.equal(isCronAuthorized("secret-test", "Bearer mauvais-secret"), false);
  assert.equal(isCronAuthorized("secret-test", "Bearer secret-test"), true);
});

test("le cron envoie uniquement les rappels prévus entre 20 et 28 heures", async () => {
  const now = Date.parse("2026-07-12T12:00:00.000Z");
  const appointments = [
    { id: "trop-tot", starts_at: new Date(now + 19 * 60 * 60 * 1000).toISOString() },
    { id: "dans-la-fenetre", starts_at: new Date(now + 24 * 60 * 60 * 1000).toISOString() },
    { id: "trop-tard", starts_at: new Date(now + 29 * 60 * 60 * 1000).toISOString() },
  ];
  const sent: string[] = [];

  const result = await runAppointmentReminders(
    {
      listConfirmedAppointments: async () => appointments,
      sendReminder: async (appointment) => {
        sent.push(appointment.id);
      },
    },
    now,
  );

  assert.deepEqual(sent, ["dans-la-fenetre"]);
  assert.deepEqual(result, { candidates: 1, sent: 1, failed: 0 });
});

test("le cron comptabilise un échec SMTP sans masquer les autres envois", async () => {
  const now = Date.parse("2026-07-12T12:00:00.000Z");
  const appointments = [
    { id: "envoye", starts_at: new Date(now + 24 * 60 * 60 * 1000).toISOString() },
    { id: "echec", starts_at: new Date(now + 25 * 60 * 60 * 1000).toISOString() },
  ];

  const result = await runAppointmentReminders(
    {
      listConfirmedAppointments: async () => appointments,
      sendReminder: async (appointment) => {
        if (appointment.id === "echec") throw new Error("SMTP indisponible");
      },
    },
    now,
  );

  assert.deepEqual(result, { candidates: 2, sent: 1, failed: 1 });
});
