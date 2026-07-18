import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { listAiUsage, summarizeAiUsage } from "@/lib/ai-usage";

export const dynamic = "force-dynamic";

export default async function AiUsagePage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  const events = await listAiUsage(), summary = summarizeAiUsage(events);
  const cards = [["Requêtes aujourd’hui", summary.today.requests], ["Requêtes ce mois", summary.month.requests], ["Jetons ce mois", summary.month.inputTokens + summary.month.outputTokens], ["Coût estimé", `${summary.month.estimatedCostUsd.toFixed(4)} $ US`]];
  return <AdminShell><div className="space-y-7"><header><p className="text-xs font-black uppercase tracking-[.24em] text-canada">Pilotage Julie 2.0</p><h1 className="mt-2 font-display text-4xl font-black">Utilisation de l’IA</h1><p className="mt-3 text-navy/55">Les coûts restent à 0 tant que les tarifs par million de jetons ne sont pas configurés dans Vercel.</p></header><section className="grid gap-4 md:grid-cols-4">{cards.map(([label,value])=><article key={String(label)} className="rounded-2xl bg-white p-5 shadow-premium"><p className="text-xs font-black uppercase tracking-wider text-navy/45">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></article>)}</section><section className="overflow-hidden rounded-[2rem] bg-white shadow-premium"><div className="border-b border-navy/10 p-5"><h2 className="font-display text-2xl font-black">Derniers appels</h2></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-ivory text-xs uppercase text-navy/45"><tr><th className="p-4">Date</th><th className="p-4">Fonction</th><th className="p-4">Modèle</th><th className="p-4">Jetons</th><th className="p-4">Statut</th></tr></thead><tbody>{events.slice(0,100).map(event=><tr key={event.id} className="border-t border-navy/8"><td className="p-4">{new Date(event.created_at).toLocaleString("fr-CA")}</td><td className="p-4 font-bold">{event.feature}</td><td className="p-4">{event.model}</td><td className="p-4">{event.input_tokens + event.output_tokens}</td><td className="p-4">{event.status}</td></tr>)}</tbody></table></div></section></div></AdminShell>;
}
