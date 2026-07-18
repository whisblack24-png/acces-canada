import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Download, FileText, UploadCloud } from "lucide-react";
import { ClientPanel, ClientShell } from "@/components/client/ClientShell";
import { ClientUploadForm } from "@/components/client/ClientUploadForm";
import { getClientSession } from "@/lib/client-auth";
import { getClient } from "@/lib/admin-data";
import { listGeneratedDocumentsForClient } from "@/lib/admin-documents";
import { listClientUploads } from "@/lib/client-portal";
import { formatDateFr } from "@/lib/format";

export const metadata: Metadata = {
  title: "Documents client",
};

export default async function ClientDocumentsPage() {
  const session = await getClientSession();
  if (!session) redirect("/client/login");

  const client = await getClient(session.clientId).catch(() => null);
  if (!client) redirect("/client/login");

  const [allUploads, generatedDocuments] = await Promise.all([
    listClientUploads(client.id, true).catch(() => []),
    listGeneratedDocumentsForClient(client.id).catch(() => []),
  ]);
  const uploadHistory=allUploads.filter(document=>document.uploaded_by==="client"||document.visible_to_client);
  const sharedDocuments=uploadHistory.filter(document=>document.status==="active"&&document.visible_to_client);

  return (
    <ClientShell>
      <div className="space-y-8">
        <section>
          <p className="text-sm font-black uppercase tracking-[0.24em] text-canada">Documents</p>
          <h1 className="mt-3 font-display text-4xl font-black text-navy md:text-6xl">Dépôts et téléchargements</h1>
          <p className="mt-4 max-w-3xl leading-8 text-navy/62">
            Espace de {client.full_name}. Envoyez vos pièces justificatives et téléchargez les documents préparés par Accès Canada.
          </p>
          <div className="mt-5 flex flex-wrap gap-3"><a href="#depot-client" className="rounded-full bg-canada px-5 py-3 text-sm font-black text-white">Déposer mes documents</a><a href="/client/dashboard#messagerie" className="rounded-full border border-navy/15 bg-white px-5 py-3 text-sm font-black text-navy">Poser une question</a></div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div id="depot-client"><ClientPanel title="Envoyer un document" icon={<UploadCloud className="h-5 w-5" />}><ClientUploadForm initialUploads={uploadHistory.filter((document) => document.status === "active")} /></ClientPanel></div>

          <ClientPanel title="Documents générés par Accès Canada" icon={<FileText className="h-5 w-5" />}>
            <div className="space-y-3">
              {generatedDocuments.length ? (
                generatedDocuments.map((document) => (
                  <a
                    key={document.id}
                    href={`/api/client/generated-documents/${document.id}/download`}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-ivory p-4 font-bold text-navy/74 transition hover:bg-gold/15"
                  >
                    <span>
                      <span className="block">{document.document_label}</span>
                      <span className="mt-1 block text-xs text-navy/42">{formatDateFr(document.created_at)}</span>
                    </span>
                    <Download className="h-4 w-4" />
                  </a>
                ))
              ) : (
                <p className="rounded-2xl bg-ivory p-4 text-sm font-bold text-navy/52">Aucun document disponible pour le moment.</p>
              )}
            </div>
          </ClientPanel>
        </div>
        <ClientPanel title="Documents et instructions d’Accès Canada" icon={<FileText className="h-5 w-5"/>}>
          <div className="space-y-4">{sharedDocuments.length?sharedDocuments.map(document=><article key={document.id} className="rounded-2xl border border-gold/25 bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-display text-xl font-black text-navy">{document.file_name}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-navy/65">{document.portal_summary||"Document préparé par Accès Canada."}</p></div><a href={`/api/client/uploads/${document.id}/download`} className="inline-flex items-center gap-2 rounded-full bg-navy px-4 py-3 text-sm font-black text-white"><Download className="h-4 w-4"/>Télécharger</a></div>{document.portal_actions?.length?<div className="mt-4 rounded-xl bg-ivory p-4"><strong className="text-sm text-navy">Actions demandées</strong><ul className="mt-2 space-y-2 text-sm text-navy/65">{document.portal_actions.map((action,index)=><li key={index} className="flex gap-2"><span className="font-black text-gold">•</span><span>{action}</span></li>)}</ul></div>:null}{document.portal_deadline?<p className="mt-3 text-sm font-black text-canada">Date limite : {formatDateFr(document.portal_deadline)}</p>:null}</article>):<p className="rounded-2xl bg-ivory p-4 text-sm font-bold text-navy/52">Aucun document accompagné d’instructions pour le moment.</p>}</div>
        </ClientPanel>
        <ClientPanel title="Historique de mes documents" icon={<FileText className="h-5 w-5" />}>
          <div className="space-y-3">{uploadHistory.length ? uploadHistory.map((document) => <div key={document.id} className="flex items-center justify-between rounded-2xl bg-ivory p-4"><span><strong className="block text-navy">{document.file_name}</strong><small className="text-navy/45">{formatDateFr(document.created_at)} · version {document.version || 1} · {document.category || "autre"}</small></span><span className={`rounded-full px-3 py-1 text-xs font-black ${document.status === "active" ? "bg-gold text-navy" : "bg-navy/8 text-navy/45"}`}>{document.status === "active" ? "Actif" : document.status === "replaced" ? "Remplacé" : "Supprimé"}</span></div>) : <p className="rounded-2xl bg-ivory p-4 text-sm font-bold text-navy/52">Aucun historique documentaire.</p>}</div>
        </ClientPanel>
      </div>
    </ClientShell>
  );
}
