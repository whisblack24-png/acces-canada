import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { JulieWorkspace } from "@/components/admin/JulieWorkspace";
import { isAdminAuthenticated } from "@/lib/admin-auth";
export default async function JuliePage(){if(!(await isAdminAuthenticated()))redirect("/admin/login");return <AdminShell><div className="min-w-0 space-y-7"><header><p className="text-xs font-black uppercase tracking-[.24em] text-canada">Assistance administrative</p><h1 className="mt-2 break-words font-display text-3xl font-black sm:text-4xl">Espace de travail Julie</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-navy/55">Importation, analyse, classement et gestion des documents clients.</p></header><JulieWorkspace/></div></AdminShell>}
