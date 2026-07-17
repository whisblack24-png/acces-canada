import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { PremiumAdminDashboard } from "@/components/admin/PremiumAdminDashboard";
import { getAdminIdentity,isAdminAuthenticated } from "@/lib/admin-auth";
import { getJulieDashboardBriefing } from "@/lib/julie";
import { listClients } from "@/lib/admin-data";
import { listAppointments } from "@/lib/booking";
import { listGeneratedDocuments } from "@/lib/admin-documents";
import { listAllClientMessages, listAllClientUploads } from "@/lib/client-portal";
import { listAllClientPayments } from "@/lib/production-workflow";
import { buildAdminDashboard } from "@/lib/admin-dashboard";
import { listAllReminders, listAllTasks } from "@/lib/crm";

export const metadata: Metadata = { title: "Tableau de bord administrateur" };

export default async function AdminDashboardPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  const identity=await getAdminIdentity();
  const [clients, appointments, documents, uploads, messages, payments, tasks, reminders,briefing] = await Promise.all([
    listClients(), listAppointments(), listGeneratedDocuments(), listAllClientUploads(), listAllClientMessages(), listAllClientPayments(), listAllTasks(), listAllReminders(),
    identity?.id?getJulieDashboardBriefing(identity.id):Promise.resolve(null),
  ]);
  return <AdminShell><PremiumAdminDashboard data={buildAdminDashboard({ clients, appointments, documents, uploads, messages, payments })} tasks={tasks} reminders={reminders} briefing={briefing} /></AdminShell>;
}
