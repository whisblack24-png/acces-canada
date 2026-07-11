import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, Download, FileSpreadsheet, FileText, FolderKanban, Landmark, UploadCloud, UsersRound, type LucideIcon } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { listClients, serviceLabels, statusLabels } from "@/lib/admin-data";
import type { ServiceType } from "@/lib/admin-data";
import { buildAdminReport, type ReportRow } from "@/lib/admin-reports";
import { formatDateFr, formatMoney } from "@/lib/format";

export const metadata: Metadata = {
  title: "Rapports",
};

export const dynamic = "force-dynamic";

function money(value: number) {
  return formatMoney(value);
}

function MetricCard({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <div className="rounded-lg bg-white p-5 shadow-premium">
      <span className="grid h-11 w-11 place-items-center rounded-lg bg-gold/20 text-navy">
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-navy/42">{label}</p>
      <p className="mt-2 text-2xl font-black text-navy">{value}</p>
    </div>
  );
}

function ReportPanel({ title, rows, empty }: { title: string; rows: ReportRow[]; empty: string }) {
  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <section className="rounded-lg bg-white p-6 shadow-premium">
      <h2 className="font-display text-2xl font-black text-navy">{title}</h2>
      <div className="mt-5 space-y-4">
        {rows.length ? (
          rows.map((row) => (
            <div key={row.label}>
              <div className="flex items-center justify-between gap-4 text-sm font-black text-navy">
                <span>{row.label}</span>
                <span>{row.value}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-ivory">
                <div className="h-full rounded-full bg-gold" style={{ width: `${Math.max(4, (row.value / max) * 100)}%` }} />
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-lg bg-ivory p-4 text-sm font-bold text-navy/52">{empty}</p>
        )}
      </div>
    </section>
  );
}

export default async function AdminReportsPage() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  const clients = await listClients().catch(() => []);
  const report = await buildAdminReport(clients);

  const metrics = [
    { label: "Clients", value: String(report.totals.clients), icon: UsersRound },
    { label: "Dossiers actifs", value: String(report.totals.activeCases), icon: FolderKanban },
    { label: "Dossiers terminés", value: String(report.totals.completedCases), icon: FileText },
    { label: "Documents envoyés", value: String(report.totals.uploadedDocuments), icon: UploadCloud },
    { label: "Paiements en attente", value: String(report.totals.pendingPayments), icon: Landmark },
    { label: "Revenus", value: money(report.totals.revenue), icon: BarChart3 },
  ];

  return (
    <AdminShell>
      <div className="space-y-8">
        <section className="rounded-lg bg-navy p-7 text-white shadow-premium md:p-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.24em] text-gold">Module Rapports</p>
              <h1 className="mt-4 font-display text-4xl font-black md:text-5xl">Rapports PDF et Excel.</h1>
              <p className="mt-5 max-w-3xl leading-8 text-white/66">
                Analysez les clients, dossiers, paiements et performances d'Accès Canada avec des exports professionnels.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/api/admin/rapports/export"
                target="_blank"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-black text-navy transition hover:bg-white"
              >
                <Download className="h-4 w-4" />
                Exporter PDF
              </Link>
              <Link
                href="/api/admin/rapports/export?format=excel"
                target="_blank"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-black text-navy transition hover:bg-gold"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Exporter Excel
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {metrics.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <ReportPanel title="Statuts des dossiers" rows={report.byStatus} empty="Aucun statut disponible." />
          <ReportPanel title="Types de services" rows={report.byService} empty="Aucun service disponible." />
          <ReportPanel title="Documents générés" rows={report.documentsByType} empty="Aucun document généré." />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-lg bg-white p-6 shadow-premium">
            <h2 className="font-display text-2xl font-black text-navy">Dossiers récents</h2>
            <div className="mt-5 overflow-hidden rounded-lg border border-navy/8">
              <div className="grid grid-cols-[1.1fr_0.8fr_0.7fr_0.55fr] bg-navy px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-white/72">
                <span>Client</span>
                <span>Service</span>
                <span>Statut</span>
                <span>Payé</span>
              </div>
              {report.recentClients.length ? (
                report.recentClients.map((client) => (
                  <div key={client.id} className="grid grid-cols-[1.1fr_0.8fr_0.7fr_0.55fr] gap-3 border-t border-navy/8 px-4 py-4 text-sm font-bold text-navy/72">
                    <span>
                      <span className="block text-navy">{client.full_name}</span>
                      <span className="mt-1 block text-xs text-navy/42">{client.file_reference || "Référence à créer"}</span>
                    </span>
                    <span>{serviceLabels[client.service as ServiceType] || client.service}</span>
                    <span>{statusLabels[client.status] || client.status}</span>
                    <span>{money(Number(client.paid_amount || 0))}</span>
                  </div>
                ))
              ) : (
                <p className="p-4 text-sm font-bold text-navy/52">Aucun client enregistré pour le moment.</p>
              )}
            </div>
          </div>

          <div className="rounded-lg bg-white p-6 shadow-premium">
            <h2 className="font-display text-2xl font-black text-navy">Synthèse documentaire</h2>
            <div className="mt-5 space-y-3">
              <div className="rounded-lg bg-ivory p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-navy/42">Documents reçus</p>
                <p className="mt-2 text-3xl font-black text-navy">{report.totals.documentsReceived}</p>
              </div>
              <div className="rounded-lg bg-ivory p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-navy/42">Documents manquants</p>
                <p className="mt-2 text-3xl font-black text-canada">{report.totals.documentsMissing}</p>
              </div>
              <div className="rounded-lg bg-gold/15 p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-navy/42">Dernière génération</p>
                <p className="mt-2 text-sm font-black text-navy">
                  {report.generatedDocuments[0]
                    ? formatDateFr(report.generatedDocuments[0].created_at)
                    : "Aucun document"}
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
