import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { JulieApprovalQueue } from "@/components/admin/JulieApprovalQueue";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { listJulieApprovals } from "@/lib/julie";
export default async function ApprovalsPage(){if(!(await isAdminAuthenticated()))redirect("/admin/login");return <AdminShell><div className="space-y-7"><header><p className="text-xs font-black uppercase tracking-[.24em] text-canada">Contrôle humain</p><h1 className="mt-2 font-display text-4xl font-black">Approbations du directeur</h1><p className="mt-3 max-w-3xl text-navy/55">Les documents et actions sensibles préparés par Julie restent bloqués jusqu’à votre décision.</p></header><JulieApprovalQueue initial={await listJulieApprovals()}/></div></AdminShell>}
