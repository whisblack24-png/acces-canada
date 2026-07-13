import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, CalendarDays, CheckCircle2, CreditCard, FileSignature, FileText, FolderKanban, UploadCloud } from "lucide-react";
import { ClientPanel, ClientShell } from "@/components/client/ClientShell";
import { ClientUploadForm } from "@/components/client/ClientUploadForm";
import { ClientPaymentPanel, ClientSignaturePanel } from "@/components/client/ClientProductionActions";
import { getClientSession } from "@/lib/client-auth";
import { getClient, serviceLabels, statusLabels } from "@/lib/admin-data";
import { listGeneratedDocumentsForClient } from "@/lib/admin-documents";
import { listClientUploads } from "@/lib/client-portal";
import type { ServiceType } from "@/lib/admin-data";
import { formatDateFr } from "@/lib/format";
import { formatDateTimeFr, listAppointmentsForEmail } from "@/lib/booking";
import { listClientPayments, listClientSignatures } from "@/lib/production-workflow";

export const metadata: Metadata = {
  title: "Tableau de bord client",
};

export default async function ClientDashboardPage() {
  const session = await getClientSession();
  if (!session) redirect("/client/login");

  const client = await getClient(session.clientId).catch(() => null);
  if (!client) redirect("/client/login");

  const [uploads, documents, signatures, payments, appointments] = await Promise.all([
    listClientUploads(client.id).catch(() => []),
    listGeneratedDocumentsForClient(client.id).catch(() => []),
    listClientSignatures(client.id).catch(() => []),
    listClientPayments(client.id).catch(() => []),
    listAppointmentsForEmail(client.email).catch(() => []),
  ]);
  const progress = dossierProgress(client.status);
  const upcomingAppointments = appointments.filter((appointment) => appointment.status === "confirmed" && new Date(appointment.starts_at) >= new Date());

  return (
    <ClientShell>
      <div className="space-y-8">
        <section className="rounded-[2rem] bg-navy p-7 text-white shadow-premium md:p-10">
          <p className="text-sm font-black uppercase tracking-[0.24em] text-gold">Bienvenue</p>
          <h1 className="mt-4 font-display text-4xl font-black md:text-6xl">{client.full_name}</h1>
          <p className="mt-5 max-w-3xl leading-8 text-white/66">
            Suivez l'état de votre dossier, déposez vos documents et téléchargez les pièces préparées par Accès Canada.
          </p>
        </section>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <Stat label="Statut" value={statusLabels[client.status] || client.status} />
          <Stat label="Service" value={serviceLabels[client.service as ServiceType] || client.service} />
          <Stat label="Référence" value={client.file_reference || "À créer"} />
          <Stat label="Documents" value={`${uploads.length} envoyés / ${documents.length} générés`} />
        </section>

        <ClientPanel title="Progression du dossier" icon={<FolderKanban className="h-5 w-5" />}>
          <div className="flex items-center justify-between text-sm font-black text-navy"><span>{progress.label}</span><span>{progress.value} %</span></div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-navy/8"><div className="h-full rounded-full bg-gradient-to-r from-canada via-gold to-navy" style={{ width: `${progress.value}%` }} /></div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[10px] font-black uppercase tracking-[0.12em] text-navy/42 sm:grid-cols-6">
            {["Nouveau", "En cours", "Documents", "Soumis", "Attente", "Terminé"].map((step) => <span key={step}>{step}</span>)}
          </div>
        </ClientPanel>

        <div className="grid gap-6 xl:grid-cols-2">
          <ClientPanel title="Mes prochains rendez-vous" icon={<CalendarDays className="h-5 w-5" />}>
            <div className="space-y-3">
              {upcomingAppointments.length ? upcomingAppointments.map((appointment) => (
                <div key={appointment.id} className="rounded-2xl bg-ivory p-4">
                  <p className="font-black text-navy">{formatDateTimeFr(appointment.starts_at)}</p>
                  <p className="mt-1 text-sm font-bold text-navy/52">{appointment.booking_reference} · {appointment.duration_minutes} minutes</p>
                </div>
              )) : <p className="rounded-2xl bg-ivory p-4 text-sm font-bold text-navy/52">Aucun rendez-vous à venir.</p>}
            </div>
          </ClientPanel>
          <ClientPanel title="Notifications de l’équipe" icon={<Bell className="h-5 w-5" />}>
            <div className="rounded-2xl border border-gold/30 bg-gold/10 p-5">
              <p className="font-black text-navy">Mise à jour du dossier : {statusLabels[client.status] || client.status}</p>
              <p className="mt-2 text-sm font-bold leading-6 text-navy/62">{client.public_notes || "Aucun nouveau message de l’équipe pour le moment."}</p>
            </div>
          </ClientPanel>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <ClientPanel title="Documents manquants" icon={<FileText className="h-5 w-5" />}>
            <DocumentList items={client.documents_missing || []} empty="Aucun document manquant indiqué." />
          </ClientPanel>
          <ClientPanel title="Documents reçus" icon={<CheckCircle2 className="h-5 w-5" />}>
            <DocumentList items={client.documents_received || []} empty="Aucun document reçu indiqué." />
          </ClientPanel>
        </div>

        <ClientPanel title="Notes de suivi" icon={<FolderKanban className="h-5 w-5" />}>
          <p className="rounded-2xl bg-ivory p-4 leading-7 text-navy/70">{client.public_notes || "Aucune note publique pour le moment."}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/client/documents" className="inline-flex items-center gap-2 rounded-full bg-canada px-5 py-3 text-sm font-black text-white">
              <UploadCloud className="h-4 w-4" />
              Envoyer un document
            </Link>
            <Link href="/client/dossier" className="inline-flex items-center gap-2 rounded-full bg-gold px-5 py-3 text-sm font-black text-navy">
              Voir mon dossier
            </Link>
          </div>
        </ClientPanel>

        <div className="grid gap-6 xl:grid-cols-2">
          <ClientPanel title="Signatures électroniques" icon={<FileSignature className="h-5 w-5" />}>
            <ClientSignaturePanel initialSignatures={signatures} />
          </ClientPanel>
          <ClientPanel title="Paiements sécurisés" icon={<CreditCard className="h-5 w-5" />}>
            <ClientPaymentPanel initialPayments={payments} />
          </ClientPanel>
        </div>

        <ClientPanel title="Factures de consultation" icon={<CreditCard className="h-5 w-5" />}>
          <div className="space-y-3">
            {appointments.length ? (
              appointments.map((appointment) => (
                <a
                  key={appointment.id}
                  href={`/api/booking/invoice/${appointment.id}`}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-ivory p-4 font-bold text-navy/74 transition hover:bg-gold/15"
                >
                  <span>
                    <span className="block">{appointment.invoice_number}</span>
                    <span className="mt-1 block text-xs text-navy/42">{formatDateTimeFr(appointment.starts_at)}</span>
                  </span>
                  Télécharger
                </a>
              ))
            ) : (
              <p className="rounded-2xl bg-ivory p-4 text-sm font-bold text-navy/52">Aucune facture de consultation disponible.</p>
            )}
          </div>
        </ClientPanel>

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <ClientPanel title="Dépôt rapide" icon={<UploadCloud className="h-5 w-5" />}>
            <ClientUploadForm initialUploads={uploads.slice(0, 5)} />
          </ClientPanel>

          <ClientPanel title="Documents disponibles" icon={<FileText className="h-5 w-5" />}>
            <div className="space-y-3">
              {documents.length ? (
                documents.slice(0, 6).map((document) => (
                  <a
                    key={document.id}
                    href={`/api/client/generated-documents/${document.id}/download`}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-ivory p-4 font-bold text-navy/74 transition hover:bg-gold/15"
                  >
                    <span>
                      <span className="block">{document.document_label}</span>
                      <span className="mt-1 block text-xs text-navy/42">{formatDateFr(document.created_at)}</span>
                    </span>
                    Télécharger
                  </a>
                ))
              ) : (
                <p className="rounded-2xl bg-ivory p-4 text-sm font-bold text-navy/52">Aucun document généré pour le moment.</p>
              )}
            </div>
          </ClientPanel>
        </div>
      </div>
    </ClientShell>
  );
}

function dossierProgress(status: string) {
  const values: Record<string, { value: number; label: string }> = {
    nouveau: { value: 10, label: "Dossier créé" },
    en_analyse: { value: 30, label: "Analyse en cours" },
    documents_recus: { value: 50, label: "Documents reçus" },
    depose: { value: 70, label: "Dossier soumis" },
    soumis: { value: 70, label: "Dossier soumis" },
    en_attente: { value: 85, label: "En attente de décision" },
    termine: { value: 100, label: "Dossier terminé" },
    approuve: { value: 100, label: "Dossier approuvé" },
    refuse: { value: 100, label: "Décision reçue" },
  };
  return values[status] || { value: 30, label: "Traitement en cours" };
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.5rem] bg-white p-6 shadow-premium">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-navy/42">{label}</p>
      <p className="mt-3 text-xl font-black text-navy">{value}</p>
    </div>
  );
}

function DocumentList({ items, empty }: { items: string[]; empty: string }) {
  return items.length ? (
    <div className="space-y-2">
      {items.map((item) => (
        <p key={item} className="rounded-2xl bg-ivory p-4 font-bold text-navy/74">{item}</p>
      ))}
    </div>
  ) : (
    <p className="rounded-2xl bg-ivory p-4 text-sm font-bold text-navy/52">{empty}</p>
  );
}
