import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, BarChart3, CalendarCheck, CheckCircle2, CreditCard, DollarSign, Download, FileText, FolderKanban, UsersRound } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { dashboardStats, dossierStatuses, listClients, serviceLabels, statusLabels } from "@/lib/admin-data";
import type { ClientStatus, ServiceType } from "@/lib/admin-data";
import { listAppointments } from "@/lib/booking";
import { formatMoney } from "@/lib/format";

export const metadata: Metadata = {
  title: "Administration",
};

function money(value: number) {
  return formatMoney(value);
}

export default async function AdminDashboardPage() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  const [clients, appointments] = await Promise.all([
    listClients().catch(() => []),
    listAppointments().catch(() => []),
  ]);
  const stats = dashboardStats(clients);
  const confirmedAppointments = appointments.filter((appointment) => appointment.status === "confirmed");
  const consultationRevenue = confirmedAppointments.reduce((total, appointment) => total + appointment.amount_cents / 100, 0);
  const statusCounts = dossierStatuses.map((status) => ({
    status,
    label: statusLabels[status],
    count: clients.filter((client) => client.status === status).length,
  }));
  const maxStatusCount = Math.max(...statusCounts.map((row) => row.count), 1);
  const recentClients = clients.slice(0, 6);

  const cards = [
    { label: "Clients", value: stats.clients.toString(), icon: UsersRound },
    { label: "Dossiers actifs", value: stats.active.toString(), icon: FolderKanban },
    { label: "Dossiers terminés", value: stats.completed.toString(), icon: CheckCircle2 },
    { label: "Paiements en attente", value: stats.pendingPayments.toString(), icon: AlertCircle },
    { label: "Revenus", value: money(stats.revenue), icon: DollarSign },
    { label: "Rendez-vous", value: confirmedAppointments.length.toString(), icon: CreditCard },
    { label: "Consultations", value: `${money(consultationRevenue)} USD`, icon: CalendarCheck },
  ];

  return (
    <AdminShell>
      <div className="space-y-7">
        <section className="bg-navy px-6 py-7 text-white shadow-premium md:px-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.24em] text-gold">Centre de gestion</p>
              <h1 className="mt-3 font-display text-4xl font-black md:text-5xl">Pilotage CRM Accès Canada</h1>
              <p className="mt-4 max-w-3xl leading-8 text-white/66">
                Vue opérationnelle des clients, dossiers, paiements, documents et prochaines évolutions du logiciel.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/admin/rapports" className="inline-flex items-center gap-2 bg-white px-5 py-3 text-sm font-black text-navy transition hover:bg-gold">
                <BarChart3 className="h-4 w-4" />
                Rapports
              </Link>
              <Link href="/api/admin/rapports/export" className="inline-flex items-center gap-2 bg-gold px-5 py-3 text-sm font-black text-navy transition hover:bg-white">
                <Download className="h-4 w-4" />
                PDF
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
          {cards.map((card) => (
            <div key={card.label} className="bg-white p-5 shadow-premium">
              <span className="grid h-11 w-11 place-items-center bg-gold/20 text-navy">
                <card.icon className="h-5 w-5" />
              </span>
              <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-navy/42">{card.label}</p>
              <p className="mt-2 text-3xl font-black text-navy">{card.value}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
          <div className="bg-white p-6 shadow-premium">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-display text-2xl font-black text-navy">Suivi des statuts</h2>
              <FolderKanban className="h-5 w-5 text-canada" />
            </div>
            <div className="mt-5 space-y-4">
              {statusCounts.map((row) => (
                <div key={row.status}>
                  <div className="flex items-center justify-between text-sm font-black text-navy">
                    <span>{row.label}</span>
                    <span>{row.count}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden bg-ivory">
                    <div className="h-full bg-gold" style={{ width: `${Math.max(3, (row.count / maxStatusCount) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 shadow-premium">
            <h2 className="font-display text-2xl font-black text-navy">Architecture évolutive</h2>
            <div className="mt-5 grid gap-3 text-sm font-bold leading-6 text-navy/66">
              {[
                "Facturation: revenus et paiements déjà isolés pour connecter un module de factures.",
                "Portail client: documents, notes publiques et historique prêts pour l'espace externe.",
                "Rendez-vous: indicateur réservé au tableau de bord pour intégration calendrier.",
                "Paiements: suivi des encaissements et paiements en attente centralisé.",
              ].map((item) => (
                <div key={item} className="bg-ivory p-4">{item}</div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white p-6 shadow-premium">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-2xl font-black text-navy">Dossiers récents</h2>
            <Link href="/admin/clients" className="text-sm font-black text-canada transition hover:text-navy">
              Voir les clients
            </Link>
          </div>
          <div className="mt-5 overflow-hidden border border-navy/10">
            <div className="hidden grid-cols-[1fr_0.7fr_0.7fr_0.55fr] bg-navy px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-white/70 md:grid">
              <span>Client</span>
              <span>Service</span>
              <span>Statut</span>
              <span>Montant</span>
            </div>
            {recentClients.length ? (
              recentClients.map((client) => (
                <div key={client.id} className="grid gap-3 border-t border-navy/10 px-4 py-4 text-sm font-bold text-navy/70 md:grid-cols-[1fr_0.7fr_0.7fr_0.55fr]">
                  <span>
                    <span className="block font-black text-navy">{client.full_name}</span>
                    <span className="mt-1 block text-xs text-navy/42">{client.file_reference || "Référence à créer"}</span>
                  </span>
                  <span>{serviceLabels[client.service as ServiceType] || client.service}</span>
                  <span>{statusLabels[client.status as ClientStatus] || client.status}</span>
                  <span>{money(Number(client.paid_amount || 0))}</span>
                </div>
              ))
            ) : (
              <p className="p-5 text-sm font-bold text-navy/50">Aucun client enregistré pour le moment.</p>
            )}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
