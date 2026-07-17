import { ArrowDownRight, ArrowUpRight, BadgeDollarSign, Banknote, CircleDollarSign, ReceiptText } from "lucide-react";
import { formatCad, formatUsd } from "@/lib/format";
import type { buildFinancialDashboard } from "@/lib/finance";

type Data = ReturnType<typeof buildFinancialDashboard>;

export function FinancialDashboard({ data }: { data: Data }) {
  const cards = [
    ["Paiements bruts", formatUsd(data.totals.grossUsd), CircleDollarSign],
    ["Frais Stripe", formatUsd(data.totals.feesUsd), ReceiptText],
    ["Remboursements", formatUsd(data.totals.refundedUsd), ArrowDownRight],
    ["Net estimé en USD", formatUsd(data.totals.netUsd), ArrowUpRight],
    ["Net versé / estimé", formatCad(data.totals.netCad), Banknote],
    ["Résultat après dépenses", formatCad(data.totals.operatingNetCad), BadgeDollarSign],
  ] as const;
  return <div className="space-y-7">
    <section className="rounded-[2rem] bg-navy p-7 text-white shadow-premium md:p-9"><p className="text-xs font-black uppercase tracking-[.22em] text-gold">Finances privées</p><h1 className="mt-3 font-display text-4xl font-black md:text-5xl">Tableau financier</h1><p className="mt-3 max-w-3xl text-white/62">Paiements, frais, conversions et revenus nets. Les valeurs marquées « estimé » utilisent les paramètres internes jusqu’à la synchronisation Stripe.</p></section>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.map(([label,value,Icon])=><article key={label} className="rounded-[1.6rem] bg-white p-5 shadow-premium"><Icon className="h-6 w-6 text-gold"/><p className="mt-4 text-xs font-black uppercase tracking-[.14em] text-navy/45">{label}</p><p className="mt-2 text-3xl font-black text-navy">{value}</p></article>)}</section>
    <section className="overflow-hidden rounded-[2rem] bg-white shadow-premium"><div className="border-b border-navy/10 p-6"><h2 className="font-display text-2xl font-black">Transactions</h2><p className="mt-1 text-sm font-bold text-navy/45">{data.totals.testTransactions} transaction(s) de test clairement identifiée(s).</p></div><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-ivory text-xs uppercase text-navy/45"><tr>{["Date","Référence","Client","Brut","Frais","Remboursé","Net CAD","Conversion","Mode"].map(h=><th key={h} className="px-5 py-4">{h}</th>)}</tr></thead><tbody>{data.transactions.map(row=><tr key={row.id} className="border-t border-navy/8"><td className="whitespace-nowrap px-5 py-4">{new Date(row.paidAt).toLocaleDateString("fr-CA")}</td><td className="px-5 py-4 font-black">{row.reference}</td><td className="px-5 py-4">{row.client}</td><td className="px-5 py-4">{formatUsd(row.grossUsd)}</td><td className="px-5 py-4">{formatUsd(row.feeUsd)}{row.feeEstimated?" (estimé)":""}</td><td className="px-5 py-4">{formatUsd(row.refundedUsd)}</td><td className="px-5 py-4 font-black">{formatCad(row.netCad)}</td><td className="px-5 py-4">{row.exchangeRate?`1 USD = ${row.exchangeRate.toLocaleString("fr-CA")} ${row.settlementCurrency}`:"Taux interne"}</td><td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-black ${row.test?"bg-amber-100 text-amber-800":"bg-emerald-100 text-emerald-800"}`}>{row.test?"TEST":"RÉEL"}</span></td></tr>)}</tbody></table>{!data.transactions.length?<p className="p-8 text-center font-bold text-navy/45">Aucune transaction.</p>:null}</div></section>
  </div>;
}
