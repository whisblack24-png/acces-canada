import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { JulieWorkspace } from "@/components/admin/JulieWorkspace";
import { isAdminAuthenticated } from "@/lib/admin-auth";
export default async function JuliePage(){if(!(await isAdminAuthenticated()))redirect("/admin/login");return <AdminShell><div className="space-y-7"><header><p className="text-xs font-black uppercase tracking-[.24em] text-canada">Assistance administrative</p><h1 className="mt-2 font-display text-4xl font-black">Conversation avec Julie</h1></header><JulieWorkspace/></div></AdminShell>}
