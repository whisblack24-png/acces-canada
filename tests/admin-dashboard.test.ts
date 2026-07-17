import assert from "node:assert/strict";
import test from "node:test";
import { buildAdminDashboard } from "../lib/admin-dashboard.ts";

test("le tableau de bord calcule revenus, rendez-vous et recherche globale", () => {
  const now = new Date("2026-07-12T14:00:00-04:00");
  const client = { id: "client-1", created_at: "2026-07-02T12:00:00Z", full_name: "Christian Nkuli Mboyo", email: "christian@example.com", service: "permis_etudes", status: "en_analyse", file_reference: "AC-2026-0001", paid_amount: 100, action_history: [] };
  const appointment = { id: "rdv-1", created_at: "2026-07-12T13:00:00Z", confirmed_at: "2026-07-12T13:05:00Z", status: "confirmed", starts_at: "2026-07-12T19:00:00Z", amount_cents: 10000, booking_reference: "AC-RDV-1", invoice_number: "AC-FAC-1", client_full_name: client.full_name, client_email: client.email };
  const cancelled = { ...appointment, id: "rdv-2", status: "cancelled", amount_cents: 99900, booking_reference: "AC-RDV-2", invoice_number: "AC-FAC-2" };
  const data = buildAdminDashboard({ clients: [client] as never, appointments: [appointment, cancelled] as never, documents: [], uploads: [], messages: [], payments: [], now });
  assert.equal(data.metrics.revenueDay, 100);
  assert.equal(data.metrics.appointmentsToday, 1);
  assert.equal(data.metrics.newClients, 1);
  assert.equal(data.calendar[0].clientId, "client-1");
  assert.equal(data.calendar.length, 1, "un rendez-vous annulé ne doit plus apparaître dans le calendrier actif");
  assert.match(data.searchItems.map((item) => item.search).join(" "), /ac-fac-1/);
});
