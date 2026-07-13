import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CalendarClock, CheckCircle2, Clock3, CreditCard, Download, FileCheck2, FileText, Mail, MapPin, MessageSquare, Phone } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { ClientDossierActions } from "@/components/admin/ClientDossierActions";
import { ClientProductionActions } from "@/components/admin/ClientProductionActions";
import { ClientUploadedDocumentsAdmin } from "@/components/admin/ClientUploadedDocumentsAdmin";
import { SecureMessages } from "@/components/client/SecureMessages";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getClient, serviceLabels, statusLabels } from "@/lib/admin-data";
import { listGeneratedDocumentsForClient } from "@/lib/admin-documents";
import { listClientMessages, listClientUploads } from "@/lib/client-portal";
import { formatDateTimeFr, listAppointmentsForEmail } from "@/lib/booking";
import { listClientPayments } from "@/lib/production-workflow";
import { formatMoney } from "@/lib/format";
import type { ServiceType } from "@/lib/admin-data";
import { formatDateFr } from "@/lib/format";

export const metadata: Metadata = {
  title: "Dossier client",
};

type PageProps = {
  params: Promise<{ id: string }>;
};

function dateFr(value?: string | null) {
  return formatDateFr(value);
}

export default async function ClientDossierPage({ params }: PageProps) {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  const { id } = await params;
  const client = await getClient(id).catch(() => null);

  if (!client) {
    notFound();
  }

  const received = client.documents_received || [];
  const missing = client.documents_missing || [];
  const [uploadedDocuments, generatedDocuments, appointments, payments, messages] = await Promise.all([
    listClientUploads(client.id, true).catch(() => []),
    listGeneratedDocumentsForClient(client.id).catch(() => []),
    listAppointmentsForEmail(client.email).catch(() => []),
    listClientPayments(client.id).catch(() => []),
    listClientMessages(client.id).catch(() => []),
  ]);
  const history = client.action_history?.length
    ? client.action_history
    : [{ date: client.created_at, action: "Dossier client créé dans le CRM." }];

  return (
    <AdminShell>
      <div className="space-y-8">
        <Link href="/admin/clients" className="inline-flex items-center gap-2 text-sm font-black text-navy/62 transition hover:text-canada">
          <ArrowLeft className="h-4 w-4" />
          Retour aux clients
        </Link>

        <section className="overflow-hidden rounded-[2rem] bg-navy text-white shadow-premium">
          <div className="grid gap-8 p-7 md:p-10 xl:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-gold">Dossier client</p>
              <h1 className="mt-4 font-display text-4xl font-black md:text-6xl">{client.full_name}</h1>
              <p className="mt-5 max-w-3xl leading-8 text-white/68">
                Suivi administratif, documents, notes internes et génération automatique des pièces professionnelles Accès Canada.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Badge label={statusLabels[client.status] || client.status} />
                <Badge label={serviceLabels[client.service as ServiceType] || client.service} />
                <Badge label={client.file_reference || "Référence à créer"} />
              </div>
            </div>
            <ClientDossierActions clientId={client.id} clientName={client.full_name} />
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-6">
            <Panel title="Informations personnelles" icon={<FileText className="h-5 w-5" />}>
              <Info label="Nom complet" value={client.full_name} />
              <Info label="Pays" value={client.country || "Non renseigné"} icon={<MapPin className="h-4 w-4" />} />
              <Info label="Référence" value={client.file_reference || "À créer"} />
            </Panel>

            <Panel title="Coordonnées" icon={<Mail className="h-5 w-5" />}>
              <Info label="Courriel" value={client.email} icon={<Mail className="h-4 w-4" />} />
              <Info label="Téléphone" value={client.phone || "Non renseigné"} icon={<Phone className="h-4 w-4" />} />
            </Panel>

            <Panel title="Dates du dossier" icon={<CalendarClock className="h-5 w-5" />}>
              <Info label="Création" value={dateFr(client.created_at)} icon={<Clock3 className="h-4 w-4" />} />
              <Info label="Dernière mise à jour" value={dateFr(client.updated_at || client.created_at)} icon={<CheckCircle2 className="h-4 w-4" />} />
            </Panel>
          </div>

          <div className="space-y-6">
            <Panel title="Suivi du dossier" icon={<FileCheck2 className="h-5 w-5" />}>
              <Info label="Type de service" value={serviceLabels[client.service as ServiceType] || client.service} />
              <Info label="Statut" value={statusLabels[client.status] || client.status} />
              <div className="rounded-2xl bg-ivory p-4">
                <span className="block text-xs font-black uppercase tracking-[0.16em] text-navy/42">Notes publiques</span>
                <p className="mt-2 leading-7 text-navy/70">{client.public_notes || "Aucune note publique pour le client."}</p>
              </div>
              <div className="rounded-2xl bg-ivory p-4">
                <span className="block text-xs font-black uppercase tracking-[0.16em] text-navy/42">Notes internes</span>
                <p className="mt-2 leading-7 text-navy/70">{client.internal_notes || client.notes || "Aucune note interne pour ce dossier."}</p>
              </div>
            </Panel>

            <Panel title="Production client" icon={<FileCheck2 className="h-5 w-5" />}>
              <ClientProductionActions clientId={client.id} />
            </Panel>

            <div className="grid gap-6 lg:grid-cols-2">
              <Panel title="Documents reçus" icon={<CheckCircle2 className="h-5 w-5" />}>
                <DocumentList items={received} empty="Aucun document reçu indiqué." checked />
              </Panel>
              <Panel title="Documents manquants" icon={<FileText className="h-5 w-5" />}>
                <DocumentList items={missing} empty="Aucun document manquant indiqué." />
              </Panel>
            </div>

            <Panel title="Historique des actions" icon={<Clock3 className="h-5 w-5" />}>
              <div className="space-y-3">
                {history.map((item, index) => (
                  <div key={`${item.date}-${index}`} className="rounded-2xl border border-navy/10 bg-white p-4">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-gold">{dateFr(item.date)}</p>
                    <p className="mt-2 font-bold leading-6 text-navy/72">{item.action}</p>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Rendez-vous et factures" icon={<CalendarClock className="h-5 w-5" />}>
              {appointments.length ? appointments.map((appointment) => <div key={appointment.id} className="flex items-center justify-between gap-3 rounded-2xl bg-ivory p-4">
                <span><span className="block font-black text-navy">{formatDateTimeFr(appointment.starts_at)}</span><span className="text-xs font-bold text-navy/45">{appointment.booking_reference} · {appointment.invoice_number}</span></span>
                <a href={`/api/admin/appointments/${appointment.id}`} className="text-sm font-black text-canada">Voir</a>
              </div>) : <p className="rounded-2xl bg-ivory p-4 text-sm font-bold text-navy/52">Aucun rendez-vous.</p>}
            </Panel>

            <Panel title="Paiements" icon={<CreditCard className="h-5 w-5" />}>
              {payments.length ? payments.map((payment) => <div key={payment.id} className="flex items-center justify-between rounded-2xl bg-ivory p-4"><span><span className="block font-black">{payment.description}</span><span className="text-xs text-navy/45">{dateFr(payment.created_at)} · {payment.status}</span></span><strong>{formatMoney(payment.amount_cents / 100)} $</strong></div>) : <p className="rounded-2xl bg-ivory p-4 text-sm font-bold text-navy/52">Aucun paiement complémentaire.</p>}
            </Panel>

            <Panel title="Messagerie sécurisée" icon={<MessageSquare className="h-5 w-5" />}>
              <SecureMessages initialMessages={messages} adminClientId={client.id} />
            </Panel>

            <Panel title="Documents envoyés par le client" icon={<FileCheck2 className="h-5 w-5" />}>
              <ClientUploadedDocumentsAdmin clientId={client.id} documents={uploadedDocuments} />
            </Panel>

            <Panel title="Documents générés par Accès Canada" icon={<FileText className="h-5 w-5" />}>
              {generatedDocuments.length ? (
                <div className="space-y-3">
                  {generatedDocuments.map((document) => (
                    <a
                      key={document.id}
                      href={`/api/admin/documents/${document.id}/download`}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-ivory p-4 text-sm font-bold text-navy/72 transition hover:bg-gold/15"
                    >
                      <span>
                        <span className="block font-black text-navy">{document.document_label}</span>
                        <span className="mt-1 block text-xs text-navy/42">
                          {formatDateFr(document.created_at)}
                        </span>
                      </span>
                      <Download className="h-4 w-4" />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl bg-ivory p-4 text-sm font-bold text-navy/52">Aucun document généré pour ce client.</p>
              )}
            </Panel>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}

function Badge({ label }: { label: string }) {
  return <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-black text-white ring-1 ring-white/10">{label}</span>;
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-[2rem] bg-white p-5 shadow-premium md:p-7">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-gold/18 text-navy">{icon}</span>
        <h2 className="font-display text-2xl font-black text-navy">{title}</h2>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Info({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-ivory p-4">
      {icon ? <span className="mt-1 text-gold">{icon}</span> : null}
      <span>
        <span className="block text-xs font-black uppercase tracking-[0.16em] text-navy/42">{label}</span>
        <span className="mt-1 block font-bold text-navy/78">{value}</span>
      </span>
    </div>
  );
}

function DocumentList({ items, empty, checked = false }: { items: string[]; empty: string; checked?: boolean }) {
  if (!items.length) {
    return <p className="rounded-2xl bg-ivory p-4 text-sm font-bold text-navy/52">{empty}</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item} className="flex items-center gap-3 rounded-2xl bg-ivory p-4 font-bold text-navy/74">
          <span className={`grid h-6 w-6 place-items-center rounded-full text-xs ${checked ? "bg-gold text-navy" : "bg-canada text-white"}`}>
            {checked ? "✓" : "!"}
          </span>
          {item}
        </div>
      ))}
    </div>
  );
}
