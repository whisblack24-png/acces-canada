import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { ClientsManager } from "@/components/admin/ClientsManager";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { listClients } from "@/lib/admin-data";

export const metadata: Metadata = {
  title: "Clients",
};

export default async function AdminClientsPage() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  const clients = await listClients().catch(() => []);

  return (
    <AdminShell>
      <div className="space-y-8">
      <section>
        <p className="text-sm font-black uppercase tracking-[0.24em] text-canada">Gestion clients</p>
        <h1 className="mt-3 font-display text-4xl font-black text-navy md:text-6xl">Module CRM</h1>
        <p className="mt-4 max-w-3xl leading-8 text-navy/62">
          Ajoutez, modifiez, supprimez et consultez les fiches clients. Chaque fiche permet de suivre le statut du
          dossier et prépare les futures automatisations documentaires.
        </p>
      </section>
        <ClientsManager initialClients={clients} />
      </div>
    </AdminShell>
  );
}
