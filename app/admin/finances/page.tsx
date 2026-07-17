import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { FinancialDashboard } from "@/components/admin/FinancialDashboard";
import { StripeConnectionAudit } from "@/components/admin/StripeConnectionAudit";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { listAppointments } from "@/lib/booking";
import { buildFinancialDashboard, getFinanceSettings, listFinanceExpenses } from "@/lib/finance";
import { listAllClientPayments } from "@/lib/production-workflow";

export const dynamic = "force-dynamic";
export default async function FinancesPage(){if(!(await isAdminAuthenticated()))redirect("/admin/login");const[appointments,payments,expenses,settings]=await Promise.all([listAppointments(),listAllClientPayments(),listFinanceExpenses(),getFinanceSettings()]);return <AdminShell><StripeConnectionAudit/><FinancialDashboard data={buildFinancialDashboard({appointments,payments,expenses,settings})}/></AdminShell>}
