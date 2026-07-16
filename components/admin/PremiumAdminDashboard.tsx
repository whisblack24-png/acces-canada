"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Bell, CalendarDays, CheckCircle2, CircleDollarSign, Clock3, FileCheck2, FilePlus2, FileText, FolderClock, MessageSquare, Plus, Search, TrendingUp, UserPlus } from "lucide-react";
import type { buildAdminDashboard } from "@/lib/admin-dashboard";
import { formatMoney } from "@/lib/format";
import { buildCrmStats, type ClientReminder, type ClientTask } from "@/lib/crm";

type DashboardData = ReturnType<typeof buildAdminDashboard>;
type ChartMetric = "revenue" | "appointments" | "clients";

export function PremiumAdminDashboard({ data, tasks, reminders }: { data: DashboardData; tasks: ClientTask[]; reminders: ClientReminder[] }) {
  const [query, setQuery] = useState("");
  const [chartMetric, setChartMetric] = useState<ChartMetric>("revenue");
  const router = useRouter();
  useEffect(() => { const timer = window.setInterval(() => router.refresh(), 60_000); return () => window.clearInterval(timer); }, [router]);
  const results = useMemo(() => query.trim().length < 2 ? [] : data.searchItems.filter((item) => item.search.includes(query.toLowerCase().trim())).slice(0, 8), [data.searchItems, query]);
  const crm = buildCrmStats(tasks, reminders);
  const metrics = [
    ["CA aujourd’hui", `${formatMoney(data.metrics.revenueDay)} $`, CircleDollarSign], ["CA cette semaine", `${formatMoney(data.metrics.revenueWeek)} $`, TrendingUp],
    ["CA ce mois", `${formatMoney(data.metrics.revenueMonth)} $`, BarChart3], ["CA cette année", `${formatMoney(data.metrics.revenueYear)} $`, CircleDollarSign],
    ["Rendez-vous aujourd’hui", data.metrics.appointmentsToday, CalendarDays], ["Rendez-vous à venir", data.metrics.upcomingAppointments, Clock3],
    ["Nouveaux clients", data.metrics.newClients, UserPlus], ["Dossiers en attente", data.metrics.pendingCases, FolderClock],
    ["Dossiers terminés", data.metrics.completedCases, CheckCircle2], ["Paiements reçus", data.metrics.paymentsReceived, CircleDollarSign],
    ["Factures générées", data.metrics.invoices, FileText], ["Documents à valider", data.metrics.pendingDocuments, FileCheck2],
    ["Messages non lus", data.metrics.unreadMessages, Bell],
    ["Tâches ouvertes", crm.openTasks, FileCheck2], ["Rappels échus", crm.dueReminders, Bell],
  ] as const;

  return <div className="space-y-7">
    <section className="overflow-visible rounded-[2rem] bg-navy p-6 text-white shadow-premium md:p-8">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between"><div><p className="text-xs font-black uppercase tracking-[.24em] text-gold">Centre de pilotage</p><h1 className="mt-3 font-display text-4xl font-black md:text-5xl">Bonjour, Accès Canada.</h1><p className="mt-3 max-w-2xl text-white/60">Toute l’activité du cabinet, les priorités et les prochaines actions sur un seul écran.</p></div><QuickActions /></div>
      <div className="relative mt-7 max-w-3xl"><Search className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-navy/40" /><input aria-label="Recherche globale" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un client, dossier, rendez-vous ou facture…" className="w-full rounded-2xl bg-white py-4 pl-14 pr-5 font-bold text-navy outline-none ring-2 ring-transparent focus:ring-gold" />
        {query.trim().length >= 2 ? <div className="absolute inset-x-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl bg-white text-navy shadow-2xl">{results.length ? results.map((item) => <Link key={item.id} href={item.href} className="flex items-center justify-between border-b border-navy/8 px-5 py-4 transition hover:bg-gold/10"><span><strong className="block">{item.title}</strong><small className="text-navy/45">{item.subtitle}</small></span><span className="rounded-full bg-navy/8 px-3 py-1 text-[10px] font-black uppercase">{item.type}</span></Link>) : <p className="p-5 text-sm font-bold text-navy/45">Aucun résultat.</p>}</div> : null}
      </div>
    </section>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">{metrics.map(([label, value, Icon], index) => <article key={label} className={`group rounded-[1.5rem] p-5 shadow-premium transition duration-300 hover:-translate-y-1 ${index < 4 ? "bg-navy text-white" : "bg-white text-navy"}`}><span className={`grid h-10 w-10 place-items-center rounded-xl ${index < 4 ? "bg-gold text-navy" : "bg-gold/18"}`}><Icon className="h-5 w-5" /></span><p className={`mt-5 text-[10px] font-black uppercase tracking-[.15em] ${index < 4 ? "text-white/45" : "text-navy/40"}`}>{label}</p><p className="mt-2 text-3xl font-black">{value}</p></article>)}</section>

    <section className="grid gap-6 2xl:grid-cols-[1.35fr_.65fr]">
      <Panel title="Tendances sur 12 mois" icon={<TrendingUp className="h-5 w-5" />}><div className="mb-6 flex flex-wrap gap-2">{(["revenue","appointments","clients"] as ChartMetric[]).map((metric) => <button type="button" key={metric} onClick={() => setChartMetric(metric)} className={`rounded-full px-4 py-2 text-xs font-black ${chartMetric === metric ? "bg-navy text-white" : "bg-ivory text-navy/55"}`}>{metric === "revenue" ? "Chiffre d’affaires" : metric === "appointments" ? "Rendez-vous" : "Nouveaux clients"}</button>)}</div><TrendChart rows={data.monthly} metric={chartMetric} /></Panel>
      <Panel title="Répartition des services" icon={<BarChart3 className="h-5 w-5" />}><ServiceChart rows={data.serviceCounts} /></Panel>
    </section>

    <section className="grid gap-6 2xl:grid-cols-[1.15fr_.85fr]">
      <Panel title="Calendrier des rendez-vous" icon={<CalendarDays className="h-5 w-5" />}><DashboardCalendar appointments={data.calendar} /></Panel>
      <Panel title="Activité récente" icon={<Clock3 className="h-5 w-5" />}><div className="max-h-[38rem] space-y-1 overflow-y-auto pr-2">{data.activities.map((activity) => <Link key={activity.id} href={activity.clientId ? `/admin/clients/${activity.clientId}` : "/admin"} className="flex gap-4 rounded-2xl p-3 transition hover:bg-ivory"><span className="mt-1 h-3 w-3 shrink-0 rounded-full bg-gold ring-4 ring-gold/15" /><span><strong className="block text-sm text-navy">{activity.label}</strong><span className="mt-1 block text-sm text-navy/55">{activity.detail}</span><small className="mt-1 block font-bold text-navy/30">{new Date(activity.at).toLocaleString("fr-CA")}</small></span></Link>)}</div></Panel>
    </section>
    <section className="grid gap-6 lg:grid-cols-2"><Panel title="Tâches prioritaires" icon={<FileCheck2 className="h-5 w-5" />}><OperationalList rows={tasks.filter((item)=>!["completed","cancelled"].includes(item.status)).slice(0,6).map((item)=>({id:item.id,title:item.title,detail:`${item.priority} · ${item.due_at?new Date(item.due_at).toLocaleString("fr-CA"):"sans échéance"}`,href:`/admin/clients/${item.client_id}`}))}/></Panel><Panel title="Prochains rappels" icon={<Bell className="h-5 w-5" />}><OperationalList rows={reminders.filter((item)=>item.status==="scheduled").slice(0,6).map((item)=>({id:item.id,title:item.title,detail:new Date(item.remind_at).toLocaleString("fr-CA"),href:`/admin/clients/${item.client_id}`}))}/></Panel></section>
  </div>;
}

function OperationalList({rows}:{rows:{id:string;title:string;detail:string;href:string}[]}){return rows.length?<div className="space-y-2">{rows.map((row)=><Link key={row.id} href={row.href} className="flex items-center justify-between rounded-2xl bg-ivory p-4 hover:bg-gold/15"><span><strong className="block">{row.title}</strong><small className="text-navy/45">{row.detail}</small></span><span aria-hidden>→</span></Link>)}</div>:<p className="rounded-2xl bg-ivory p-4 text-sm font-bold text-navy/50">Aucun élément à traiter.</p>}

function QuickActions() { const actions = [["Nouveau client","/admin/clients",UserPlus],["Nouveau rendez-vous","/admin/rendez-vous",Plus],["Rechercher un client","/admin/clients",Search],["Créer une facture","/admin/documents/generation",FilePlus2],["Envoyer un message","/admin/clients",MessageSquare]] as const; return <div className="flex max-w-2xl flex-wrap gap-2">{actions.map(([label,href,Icon]) => <Link key={label} href={href} className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-black text-white transition hover:bg-gold hover:text-navy"><Icon className="h-4 w-4" />{label}</Link>)}</div>; }
function Panel({ title, icon, children }: { title:string; icon:React.ReactNode; children:React.ReactNode }) { return <section className="rounded-[2rem] bg-white p-5 shadow-premium md:p-7"><header className="mb-6 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-gold/18">{icon}</span><h2 className="font-display text-2xl font-black text-navy">{title}</h2></header>{children}</section>; }

function TrendChart({ rows, metric }: { rows: DashboardData["monthly"]; metric: ChartMetric }) { const max=Math.max(...rows.map((row)=>row[metric]),1); return <div className="flex h-64 items-end gap-2 rounded-2xl bg-ivory p-4 md:gap-3">{rows.map((row)=><div key={row.key} className="group flex h-full flex-1 flex-col justify-end"><div className="relative min-h-1 rounded-t-lg bg-gradient-to-t from-navy to-gold transition-all duration-500 group-hover:from-canada" style={{height:`${Math.max(3,row[metric]/max*100)}%`}} title={`${row.label}: ${metric === "revenue" ? `${formatMoney(row[metric])} $` : row[metric]}`}><span className="absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-navy px-2 py-1 text-[9px] font-black text-white group-hover:block">{metric === "revenue" ? `${formatMoney(row[metric])} $` : row[metric]}</span></div><span className="mt-2 truncate text-center text-[9px] font-black uppercase text-navy/35">{row.label}</span></div>)}</div>; }
function ServiceChart({ rows }: { rows: DashboardData["serviceCounts"] }) { const max=Math.max(...rows.map(([,value])=>value),1); return <div className="space-y-5">{rows.length ? rows.map(([label,value])=><div key={label}><div className="flex justify-between text-sm font-black"><span className="truncate pr-4">{label.replaceAll("_"," ")}</span><span>{value}</span></div><div className="mt-2 h-3 overflow-hidden rounded-full bg-ivory"><div className="h-full rounded-full bg-gradient-to-r from-gold to-navy transition-all duration-500" style={{width:`${value/max*100}%`}} /></div></div>) : <p className="text-sm font-bold text-navy/45">Aucune donnée.</p>}</div>; }
function DashboardCalendar({ appointments }: { appointments: DashboardData["calendar"] }) { const now=new Date(); const first=new Date(now.getFullYear(),now.getMonth(),1); const days=new Date(now.getFullYear(),now.getMonth()+1,0).getDate(); const cells=[...Array(first.getDay()).fill(null),...Array.from({length:days},(_,i)=>i+1)]; return <div><div className="mb-5 flex items-center justify-between"><strong className="text-lg capitalize">{now.toLocaleDateString("fr-CA",{month:"long",year:"numeric"})}</strong><Link href="/admin/rendez-vous" className="text-sm font-black text-canada">Calendrier complet</Link></div><div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black uppercase text-navy/35">{["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"].map(day=><span key={day} className="py-2">{day}</span>)}{cells.map((day,index)=><div key={`${day}-${index}`} className={`min-h-20 rounded-xl p-2 text-left ${day ? "bg-ivory" : ""}`}>{day ? <><span className={`grid h-7 w-7 place-items-center rounded-full text-xs ${day===now.getDate()?"bg-gold font-black":""}`}>{day}</span><div className="mt-1 space-y-1">{appointments.filter((item)=>{const date=new Date(item.at);return date.getFullYear()===now.getFullYear()&&date.getMonth()===now.getMonth()&&date.getDate()===day}).slice(0,2).map(item=><Link key={item.id} href={item.clientId?`/admin/clients/${item.clientId}`:"/admin/rendez-vous"} title={`${item.name} · ${item.reference}`} className="block truncate rounded bg-navy px-2 py-1 text-[9px] font-bold text-white hover:bg-canada">{new Date(item.at).toLocaleTimeString("fr-CA",{hour:"2-digit",minute:"2-digit"})} {item.name}</Link>)}</div></> : null}</div>)}</div></div>; }
