import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Download, FileText, UploadCloud } from "lucide-react";
import { ClientPanel, ClientShell } from "@/components/client/ClientShell";
import { ClientUploadForm } from "@/components/client/ClientUploadForm";
import { getClientSession } from "@/lib/client-auth";
import { getClient } from "@/lib/admin-data";
import { listGeneratedDocumentsForClient } from "@/lib/admin-documents";
import { listClientUploads } from "@/lib/client-portal";

export const metadata: Metadata = {
  title: "Documents client",
};

export default async function ClientDocumentsPage() {
  const session = await getClientSession();
  if (!session) redirect("/client/login");

  const client = await getClient(session.clientId).catch(() => null);
  if (!client) redirect("/client/login");

  const [uploads, generatedDocuments] = await Promise.all([
    listClientUploads(client.id).catch(() => []),
    listGeneratedDocumentsForClient(client.id).catch(() => []),
  ]);

  return (
    <ClientShell>
      <div className="space-y-8">
        <section>
          <p className="text-sm font-black uppercase tracking-[0.24em] text-canada">Documents</p>
          <h1 className="mt-3 font-display text-4xl font-black text-navy md:text-6xl">Depots et telechargements</h1>
          <p className="mt-4 max-w-3xl leading-8 text-navy/62">
            Espace de {client.full_name}. Envoyez vos pieces justificatives et telechargez les documents prepares par Acces Canada.
          </p>
        </section>

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <ClientPanel title="Envoyer un document" icon={<UploadCloud className="h-5 w-5" />}>
            <ClientUploadForm initialUploads={uploads} />
          </ClientPanel>

          <ClientPanel title="Documents generes par Acces Canada" icon={<FileText className="h-5 w-5" />}>
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
                      <span className="mt-1 block text-xs text-navy/42">{new Date(document.created_at).toLocaleDateString("fr-CA")}</span>
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
      </div>
    </ClientShell>
  );
}
