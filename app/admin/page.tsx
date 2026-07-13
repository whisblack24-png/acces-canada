import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { PremiumAdminDashboard } from "@/components/admin/PremiumAdminDashboard";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { listClients } from "@/lib/admin-data";
import { listAppointments } from "@/lib/booking";
import { listGeneratedDocuments } from "@/lib/admin-documents";
import { listAllClientMessages, listAllClientUploads } from "@/lib/client-portal";
import { listAllClientPayments } from "@/lib/production-workflow";
import { buildAdminDashboard } from "@/lib/admin-dashboard";

export const metadata: Metadata = { title: "Tableau de bord administrateur" };

export default async function AdminDashboardPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  const [clients, appointments, documents, uploads, messages, payments] = await Promise.all([
    listClients(), listAppointments(), listGeneratedDocuments(), listAllClientUploads(), listAllClientMessages(), listAllClientPayments(),
  ]);
  return <AdminShell><PremiumAdminDashboard data={buildAdminDashboard({ clients, appointments, documents, uploads, messages, payments })} /></AdminShell>;
}
