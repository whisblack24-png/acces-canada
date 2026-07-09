import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarDays, CreditCard, DollarSign, FolderKanban, UsersRound } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { listClients, dashboardStats } from "@/lib/admin-data";

export const metadata: Metadata = {
  title: "Administration",
};

export default async function AdminDashboardPage() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  const clients = await listClients().catch(() => []);
  const stats = dashboardStats(clients);

  const cards = [
    { label: "Clients", value: stats.clients.toString(), icon: UsersRound },
    { label: "Rendez-vous", value: stats.appointments.toString(), icon: CalendarDays },
    { label: "Dossiers actifs", value: stats.active.toString(), icon: FolderKanban },
    { label: "Paiements", value: stats.payments.toString(), icon: CreditCard },
    { label: "Revenus", value: `${stats.revenue.toLocaleString("fr-CA")} $`, icon: DollarSign },
  ];

  return (
    <AdminShell>
      <div className="space-y-8">
      <section className="rounded-[2rem] bg-navy p-7 text-white shadow-premium md:p-10">
        <p className="text-sm font-black uppercase tracking-[0.24em] text-gold">Tableau de bord</p>
        <h1 className="mt-4 font-display text-4xl font-black md:text-6xl">Bienvenue dans l'administration.</h1>
        <p className="mt-5 max-w-3xl leading-8 text-white/66">
          Suivez les clients, les dossiers, les rendez-vous, les paiements et les revenus d'Accès Canada depuis un espace
          centralisé, sécurisé et évolutif.
        </p>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className="rounded-[1.5rem] bg-white p-6 shadow-premium">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-gold/20 text-navy">
              <card.icon className="h-6 w-6" />
            </span>
            <p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-navy/42">{card.label}</p>
            <p className="mt-2 text-3xl font-black text-navy">{card.value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[2rem] bg-white p-7 shadow-premium">
          <h2 className="font-display text-3xl font-black text-navy">Dossiers récents</h2>
          <div className="mt-5 space-y-3">
            {clients.slice(0, 5).map((client) => (
              <div key={client.id} className="flex items-center justify-between rounded-2xl bg-ivory p-4">
                <span>
                  <span className="block font-black text-navy">{client.full_name}</span>
                  <span className="mt-1 block text-sm text-navy/52">{client.service}</span>
                </span>
                <span className="rounded-full bg-gold/20 px-3 py-1 text-xs font-black text-navy">{client.status}</span>
              </div>
            ))}
            {!clients.length ? <p className="text-sm font-bold text-navy/50">Aucun client enregistré pour le moment.</p> : null}
          </div>
        </div>

        <div className="rounded-[2rem] bg-white p-7 shadow-premium">
          <h2 className="font-display text-3xl font-black text-navy">Architecture prévue</h2>
          <div className="mt-5 space-y-3 text-sm font-bold leading-7 text-navy/62">
            <p>CRM clients et statuts de dossiers.</p>
            <p>Génération automatique des contrats et factures.</p>
            <p>Intégration Calendly et Stripe dans les statistiques.</p>
            <p>Suivi documentaire, check-lists et lettres clients.</p>
          </div>
        </div>
      </section>
      </div>
    </AdminShell>
  );
}
