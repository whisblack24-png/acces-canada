import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, FileText, FolderKanban, UploadCloud } from "lucide-react";
import { ClientPanel, ClientShell } from "@/components/client/ClientShell";
import { getClientSession } from "@/lib/client-auth";
import { getClient, serviceLabels, statusLabels } from "@/lib/admin-data";
import { listGeneratedDocumentsForClient } from "@/lib/admin-documents";
import { listClientUploads } from "@/lib/client-portal";
import type { ServiceType } from "@/lib/admin-data";

export const metadata: Metadata = {
  title: "Tableau de bord client",
};

export default async function ClientDashboardPage() {
  const session = await getClientSession();
  if (!session) redirect("/client/login");

  const client = await getClient(session.clientId).catch(() => null);
  if (!client) redirect("/client/login");

  const [uploads, documents] = await Promise.all([
    listClientUploads(client.id).catch(() => []),
    listGeneratedDocumentsForClient(client.id).catch(() => []),
  ]);

  return (
    <ClientShell>
      <div className="space-y-8">
        <section className="rounded-[2rem] bg-navy p-7 text-white shadow-premium md:p-10">
          <p className="text-sm font-black uppercase tracking-[0.24em] text-gold">Bienvenue</p>
          <h1 className="mt-4 font-display text-4xl font-black md:text-6xl">{client.full_name}</h1>
          <p className="mt-5 max-w-3xl leading-8 text-white/66">
            Suivez l'etat de votre dossier, deposez vos documents et telechargez les pieces preparees par Acces Canada.
          </p>
        </section>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <Stat label="Statut" value={statusLabels[client.status] || client.status} />
          <Stat label="Service" value={serviceLabels[client.service as ServiceType] || client.service} />
          <Stat label="Reference" value={client.file_reference || "A creer"} />
          <Stat label="Documents" value={`${uploads.length} envoyes / ${documents.length} generes`} />
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <ClientPanel title="Documents manquants" icon={<FileText className="h-5 w-5" />}>
            <DocumentList items={client.documents_missing || []} empty="Aucun document manquant indique." />
          </ClientPanel>
          <ClientPanel title="Documents recus" icon={<CheckCircle2 className="h-5 w-5" />}>
            <DocumentList items={client.documents_received || []} empty="Aucun document recu indique." />
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
      </div>
    </ClientShell>
  );
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
