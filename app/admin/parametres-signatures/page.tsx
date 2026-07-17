import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { SignatureSettingsPanel } from "@/components/admin/SignatureSettingsPanel";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { listSignatureSettings } from "@/lib/signature-settings";
export default async function SignatureSettingsPage(){if(!(await isAdminAuthenticated()))redirect("/admin/login");const settings=await listSignatureSettings();return <AdminShell><div className="space-y-7"><header><p className="text-xs font-black uppercase tracking-[.24em] text-canada">Documents officiels</p><h1 className="mt-2 font-display text-4xl font-black">Paramètres des signatures</h1><p className="mt-3 max-w-3xl text-navy/55">Chaque image est privée et associée à une seule personne. Aucune signature générique n’est considérée comme valide.</p></header><SignatureSettingsPanel initial={settings}/></div></AdminShell>}
