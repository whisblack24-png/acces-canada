"use client";

import { useEffect, useState } from "react";

type Audit = {
  error?: string;
  secret: { configured: boolean; mode: string; masked: string | null; fingerprint: string | null };
  publishable: { configured: boolean; mode: string; masked: string | null; fingerprint: string | null };
  sameMode?: boolean | null;
  account?: {
    id: string;
    country: string;
    defaultCurrency: string;
    businessName: string | null;
    email: string | null;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
  } | null;
  recentSessions?: Array<{ id: string; livemode: boolean; paymentStatus: string; amountTotal: number; currency: string }>;
};

function KeyLine({ label, value }: { label: string; value: Audit["secret"] }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 font-mono text-sm text-slate-900">{value.masked || "Non configurée"}</p><p className="mt-1 text-xs text-slate-500">Mode : {value.mode} · Empreinte : {value.fingerprint || "—"}</p></div>;
}

export function StripeConnectionAudit() {
  const [audit, setAudit] = useState<Audit | null>(null);
  useEffect(() => { fetch("/api/admin/stripe/config-audit", { cache: "no-store" }).then(async response => setAudit(await response.json())).catch(() => setAudit({ error: "Diagnostic indisponible.", secret: { configured: false, mode: "unknown", masked: null, fingerprint: null }, publishable: { configured: false, mode: "unknown", masked: null, fingerprint: null } })); }, []);
  return <section className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-5"><div className="mb-4"><p className="text-xs font-bold uppercase tracking-[.18em] text-amber-700">Connexion Stripe</p><h2 className="mt-1 text-xl font-bold text-slate-950">Compte réellement utilisé</h2><p className="mt-1 text-sm text-slate-600">Les clés restent masquées. L’identifiant ci-dessous provient directement de l’API Stripe.</p></div>{!audit?<p className="text-sm text-slate-600">Vérification en cours…</p>:audit.error?<p className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{audit.error}</p>:<><div className="grid gap-3 md:grid-cols-2"><KeyLine label="Clé secrète" value={audit.secret}/><KeyLine label="Clé publique" value={audit.publishable}/></div><div className="mt-3 rounded-xl bg-slate-950 p-4 text-white"><p className="text-xs font-bold uppercase tracking-wider text-amber-300">Compte Stripe</p><p className="mt-2 font-mono text-sm">{audit.account?.id || "Compte non identifié"}</p><p className="mt-1 text-sm text-slate-300">{audit.account?.businessName || "Nom non renseigné"} · {audit.account?.email || "Courriel non renseigné"} · {audit.account?.country || "—"}</p><p className="mt-2 text-xs text-slate-400">Clés dans le même mode : {audit.sameMode === null ? "clé publique absente" : audit.sameMode ? "oui" : "non"} · Sessions récentes : {audit.recentSessions?.length || 0}</p></div></>}</section>;
}
