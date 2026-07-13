import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarClock, FileCheck2, FileText, FolderKanban, Mail, Phone } from "lucide-react";
import { ClientPanel, ClientShell } from "@/components/client/ClientShell";
import { getClientSession } from "@/lib/client-auth";
import { getClient, serviceLabels, statusLabels } from "@/lib/admin-data";
import type { ServiceType } from "@/lib/admin-data";
import { formatDateFr } from "@/lib/format";

export const metadata: Metadata = {
  title: "Mon dossier",
};

export default async function ClientDossierPage() {
  const session = await getClientSession();
  if (!session) redirect("/client/login");

  const client = await getClient(session.clientId).catch(() => null);
  if (!client) redirect("/client/login");
  const progress = dossierProgress(client.status);

  return (
    <ClientShell>
      <div className="space-y-8">
        <section>
          <p className="text-sm font-black uppercase tracking-[0.24em] text-canada">Mon dossier</p>
          <h1 className="mt-3 font-display text-4xl font-black text-navy md:text-6xl">{client.full_name}</h1>
          <p className="mt-4 max-w-3xl leading-8 text-navy/62">Consultez les informations principales de votre dossier Accès Canada.</p>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <ClientPanel title="Informations" icon={<FolderKanban className="h-5 w-5" />}>
            <Info label="Service" value={serviceLabels[client.service as ServiceType] || client.service} />
            <Info label="Statut" value={statusLabels[client.status] || client.status} />
            <Info label="Référence" value={client.file_reference || "À créer"} />
            <Info label="Date de création" value={formatDateFr(client.created_at)} icon={<CalendarClock className="h-4 w-4" />} />
          </ClientPanel>

          <ClientPanel title="Coordonnées" icon={<Mail className="h-5 w-5" />}>
            <Info label="Courriel" value={client.email} icon={<Mail className="h-4 w-4" />} />
            <Info label="Téléphone" value={client.phone || "Non renseigné"} icon={<Phone className="h-4 w-4" />} />
            <Info label="Pays" value={client.country || "Non renseigné"} />
          </ClientPanel>
        </div>

        <ClientPanel title="Avancement du dossier" icon={<FolderKanban className="h-5 w-5" />}>
          <div className="flex items-center justify-between font-black"><span>{progress.label}</span><span>{progress.value} %</span></div>
          <div className="mt-4 h-4 overflow-hidden rounded-full bg-navy/8"><div className="h-full rounded-full bg-gradient-to-r from-canada via-gold to-navy" style={{ width: `${progress.value}%` }} /></div>
        </ClientPanel>

        <div className="grid gap-6 lg:grid-cols-2">
          <ClientPanel title="Documents reçus" icon={<FileCheck2 className="h-5 w-5" />}>
            <List items={client.documents_received || []} empty="Aucun document reçu indiqué." />
          </ClientPanel>
          <ClientPanel title="Documents manquants" icon={<FileText className="h-5 w-5" />}>
            <List items={client.documents_missing || []} empty="Aucun document manquant indiqué." />
          </ClientPanel>
        </div>

        <ClientPanel title="Notes publiques" icon={<FileText className="h-5 w-5" />}>
          <p className="rounded-2xl bg-ivory p-4 leading-7 text-navy/70">{client.public_notes || "Aucune note publique pour le moment."}</p>
        </ClientPanel>
      </div>
    </ClientShell>
  );
}

function dossierProgress(status: string) {
  const values: Record<string, { value: number; label: string }> = {
    nouveau: { value: 10, label: "Dossier créé" }, en_analyse: { value: 30, label: "Analyse en cours" },
    documents_recus: { value: 17, label: "Documents reçus" }, en_preparation: { value: 50, label: "Préparation du dossier" }, depose: { value: 67, label: "Dossier déposé" },
    soumis: { value: 67, label: "Dossier déposé" }, en_attente: { value: 84, label: "Décision en attente" },
    termine: { value: 100, label: "Dossier terminé" }, approuve: { value: 100, label: "Dossier approuvé" },
  };
  return values[status] || { value: 30, label: "Traitement en cours" };
}

function Info({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-start gap-3 rounded-2xl bg-ivory p-4">
      {icon ? <span className="mt-1 text-gold">{icon}</span> : null}
      <span>
        <span className="block text-xs font-black uppercase tracking-[0.16em] text-navy/42">{label}</span>
        <span className="mt-1 block font-bold text-navy/78">{value}</span>
      </span>
    </div>
  );
}

function List({ items, empty }: { items: string[]; empty: string }) {
  return items.length ? (
    <div className="space-y-2">
      {items.map((item) => <p key={item} className="rounded-2xl bg-ivory p-4 font-bold text-navy/74">{item}</p>)}
    </div>
  ) : (
    <p className="rounded-2xl bg-ivory p-4 text-sm font-bold text-navy/52">{empty}</p>
  );
}
