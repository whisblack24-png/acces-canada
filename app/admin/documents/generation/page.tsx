import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { DocumentsManager } from "@/components/admin/DocumentsManager";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { listClients } from "@/lib/admin-data";
import { listGeneratedDocuments } from "@/lib/admin-documents";

export const metadata: Metadata = {
  title: "Generation de documents",
};

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ clientId?: string }>;
};

export default async function AdminDocumentGenerationPage({ searchParams }: PageProps) {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  const [{ clientId }, clients, documents] = await Promise.all([
    searchParams,
    listClients().catch(() => []),
    listGeneratedDocuments().catch(() => []),
  ]);
  const initialClientId = clients.some((client) => client.id === clientId) ? clientId : undefined;

  return (
    <AdminShell>
      <div className="space-y-8">
        <Link href="/admin/documents" className="inline-flex items-center gap-2 text-sm font-black text-navy/62 transition hover:text-canada">
          <ArrowLeft className="h-4 w-4" />
          Retour aux documents
        </Link>

        <section className="rounded-[2rem] bg-navy p-7 text-white shadow-premium md:p-10">
          <p className="text-sm font-black uppercase tracking-[0.24em] text-gold">Generation automatique</p>
          <h1 className="mt-4 font-display text-4xl font-black md:text-6xl">Creer un PDF client.</h1>
          <p className="mt-5 max-w-3xl leading-8 text-white/66">
            Selectionnez un client, choisissez le type de document, puis generez un PDF professionnel Acces Canada
            automatiquement sauvegarde dans Supabase et disponible dans l'historique du dossier.
          </p>
        </section>

        <DocumentsManager clients={clients} initialDocuments={documents} initialClientId={initialClientId} />
      </div>
    </AdminShell>
  );
}
