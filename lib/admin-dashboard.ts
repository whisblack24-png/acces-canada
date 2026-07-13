import type { AdminClient } from "./admin-data";
import type { Appointment } from "./booking-shared";
import type { GeneratedDocument } from "./admin-documents";
import type { ClientMessage, ClientUploadedDocument } from "./client-portal";
import type { ClientPayment } from "./production-workflow";

export type DashboardActivity = { id: string; at: string; type: string; label: string; detail: string; clientId?: string };
export type DashboardSearchItem = { id: string; type: string; title: string; subtitle: string; href: string; search: string };

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
const inPeriod = (value: string, after: number) => Date.parse(value) >= after;
const monthKey = (value: string) => {
  const date = new Date(value); return Number.isNaN(date.getTime()) ? "" : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

export function buildAdminDashboard(input: {
  clients: AdminClient[]; appointments: Appointment[]; documents: GeneratedDocument[];
  uploads: ClientUploadedDocument[]; messages: ClientMessage[]; payments: ClientPayment[]; now?: Date;
}) {
  const now = input.now || new Date(); const today = startOfDay(now); const tomorrow = today + 86400000;
  const week = today - 6 * 86400000; const month = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const year = new Date(now.getFullYear(), 0, 1).getTime();
  const confirmed = input.appointments.filter((item) => item.status === "confirmed");
  const revenueEvents = [
    ...confirmed.map((item) => ({ at: item.confirmed_at || item.created_at, amount: item.amount_cents / 100 })),
    ...input.payments.filter((item) => item.status === "paid").map((item) => ({ at: item.paid_at || item.created_at, amount: item.amount_cents / 100 })),
  ];
  const revenue = (after: number) => revenueEvents.filter((item) => inPeriod(item.at, after)).reduce((sum, item) => sum + item.amount, 0);
  const clientByEmail = new Map(input.clients.map((client) => [client.email.toLowerCase(), client]));
  const months = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1);
    return { key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`, label: date.toLocaleDateString("fr-CA", { month: "short" }) };
  });
  const monthly = months.map((monthItem) => ({
    ...monthItem,
    revenue: revenueEvents.filter((item) => monthKey(item.at) === monthItem.key).reduce((sum, item) => sum + item.amount, 0),
    appointments: confirmed.filter((item) => monthKey(item.starts_at) === monthItem.key).length,
    clients: input.clients.filter((item) => monthKey(item.created_at) === monthItem.key).length,
  }));
  const serviceCounts = Object.entries(input.clients.reduce<Record<string, number>>((acc, client) => { acc[client.service] = (acc[client.service] || 0) + 1; return acc; }, {}));
  const activities: DashboardActivity[] = [
    ...input.clients.map((client) => ({ id: `client-${client.id}`, at: client.created_at, type: "client", label: "Nouveau client", detail: client.full_name, clientId: client.id })),
    ...input.uploads.map((item) => ({ id: `upload-${item.id}`, at: item.created_at, type: "document", label: "Document ajouté", detail: item.file_name, clientId: item.client_id })),
    ...confirmed.map((item) => ({ id: `invoice-${item.id}`, at: item.confirmed_at || item.created_at, type: "facture", label: "Paiement et facture", detail: `${item.invoice_number} · ${item.client_full_name}`, clientId: clientByEmail.get(item.client_email.toLowerCase())?.id })),
    ...input.messages.map((item) => ({ id: `message-${item.id}`, at: item.created_at, type: "message", label: item.sender === "client" ? "Message reçu" : "Message envoyé", detail: item.body.slice(0, 90), clientId: item.client_id })),
    ...input.clients.flatMap((client) => (client.action_history || []).map((item, index) => ({ id: `history-${client.id}-${index}`, at: item.date, type: "dossier", label: "Dossier mis à jour", detail: `${client.full_name} · ${item.action}`, clientId: client.id }))),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 18);
  const searchItems: DashboardSearchItem[] = [
    ...input.clients.map((client) => ({ id: `client-${client.id}`, type: "Client", title: client.full_name, subtitle: client.file_reference || client.email, href: `/admin/clients/${client.id}`, search: `${client.full_name} ${client.email} ${client.file_reference || ""}`.toLowerCase() })),
    ...input.appointments.map((item) => ({ id: `rdv-${item.id}`, type: "Rendez-vous", title: item.booking_reference, subtitle: `${item.client_full_name} · ${item.invoice_number}`, href: clientByEmail.get(item.client_email.toLowerCase()) ? `/admin/clients/${clientByEmail.get(item.client_email.toLowerCase())!.id}` : "/admin/rendez-vous", search: `${item.booking_reference} ${item.invoice_number} ${item.client_full_name} ${item.client_email}`.toLowerCase() })),
    ...input.documents.map((item) => ({ id: `doc-${item.id}`, type: "Facture / document", title: item.document_label, subtitle: item.client_name, href: `/admin/clients/${item.client_id}`, search: `${item.document_label} ${item.file_name} ${item.client_name}`.toLowerCase() })),
  ];
  return {
    metrics: {
      revenueDay: revenue(today), revenueWeek: revenue(week), revenueMonth: revenue(month), revenueYear: revenue(year),
      appointmentsToday: confirmed.filter((item) => Date.parse(item.starts_at) >= today && Date.parse(item.starts_at) < tomorrow).length,
      upcomingAppointments: confirmed.filter((item) => Date.parse(item.starts_at) >= now.getTime()).length,
      newClients: input.clients.filter((item) => inPeriod(item.created_at, month)).length,
      pendingCases: input.clients.filter((item) => !["termine", "approuve", "refuse"].includes(item.status)).length,
      completedCases: input.clients.filter((item) => ["termine", "approuve"].includes(item.status)).length,
      paymentsReceived: revenueEvents.length,
      invoices: confirmed.length + input.documents.filter((item) => item.document_type === "facture").length,
      pendingDocuments: input.uploads.filter((item) => item.status === "active").length,
      unreadMessages: input.messages.filter((item) => item.sender === "client" && !item.read_at).length,
    }, monthly, serviceCounts, activities, searchItems,
    calendar: confirmed.map((item) => ({ id: item.id, at: item.starts_at, name: item.client_full_name, reference: item.booking_reference, clientId: clientByEmail.get(item.client_email.toLowerCase())?.id })),
  };
}
