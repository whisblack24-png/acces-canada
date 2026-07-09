import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FilePlus2 } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { DocumentsManager } from "@/components/admin/DocumentsManager";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { listClients } from "@/lib/admin-data";
import { listGeneratedDocuments } from "@/lib/admin-documents";

export const metadata: Metadata = {
  title: "Documents",
};

export default async function AdminDocumentsPage() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  const [clients, documents] = await Promise.all([
    listClients().catch(() => []),
    listGeneratedDocuments().catch(() => []),
  ]);

  return (
    <AdminShell>
      <div className="space-y-8">
        <section className="rounded-[2rem] bg-navy p-7 text-white shadow-premium md:p-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.24em] text-gold">Module Documents</p>
              <h1 className="mt-4 font-display text-4xl font-black md:text-6xl">Bibliotheque administrative.</h1>
              <p className="mt-5 max-w-3xl leading-8 text-white/66">
                Generez des documents professionnels Acces Canada a partir des informations clients du CRM, puis gardez un
                historique clair des fichiers produits.
              </p>
            </div>
            <Link
              href="/admin/documents/generation"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-black text-navy transition hover:bg-white"
            >
              <FilePlus2 className="h-4 w-4" />
              Generer document
            </Link>
          </div>
        </section>

        <DocumentsManager clients={clients} initialDocuments={documents} />
      </div>
    </AdminShell>
  );
}
