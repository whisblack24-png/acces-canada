"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Download, Eye, FileText, History, RefreshCw, Search, Send, Trash2, UploadCloud } from "lucide-react";
import type { ClientUploadedDocument } from "@/lib/client-portal";
import { DOCUMENT_ACCEPT, DOCUMENT_CATEGORIES, documentCategoryLabel } from "@/lib/document-categories";
import { formatDateFr } from "@/lib/format";
import type { DocumentAnalysis } from "@/lib/document-analysis";

export function ClientUploadedDocumentsAdmin({ clientId, documents,analyses=[] }: { clientId: string; documents: ClientUploadedDocument[];analyses?:DocumentAnalysis[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [replace, setReplace] = useState<ClientUploadedDocument | null>(null);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [shareBusy,setShareBusy]=useState<string|null>(null);
  const active = documents.filter((item) => item.status === "active");
  const filtered = active.filter((item) => {
    const matchesCategory = category === "all" || item.category === category;
    return matchesCategory && item.file_name.toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr"));
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("clientId", clientId);
    if (replace) formData.set("replaceId", replace.id);
    setBusy(true); setFeedback("");
    const response = await fetch("/api/admin/client-uploads", { method: "POST", body: formData });
    const result = (await response.json().catch(() => ({}))) as { message?: string };
    setBusy(false);
    if (!response.ok) { setFeedback(result.message || "Téléversement impossible."); return; }
    setFeedback(replace ? "Nouvelle version enregistrée." : "Document ajouté au dossier.");
    setReplace(null); form.reset(); router.refresh();
  }

  async function remove(document: ClientUploadedDocument) {
    if (!window.confirm(`Supprimer ${document.file_name} ? L’historique restera traçable.`)) return;
    const response = await fetch(`/api/admin/client-uploads/${document.id}?clientId=${clientId}`, { method: "DELETE" });
    if (!response.ok) { setFeedback("Impossible de supprimer ce document."); return; }
    setFeedback("Document supprimé du dossier actif."); router.refresh();
  }

  async function restore(document: ClientUploadedDocument) {
    if (!window.confirm(`Restaurer la version ${document.version} de ${document.file_name} ? La version active sera archivée.`)) return;
    const response = await fetch(`/api/admin/client-uploads/${document.id}/restore?clientId=${clientId}`, { method: "POST" });
    if (!response.ok) { setFeedback("Impossible de restaurer cette version."); return; }
    setFeedback(`Version ${document.version} restaurée.`); router.refresh();
  }

  async function share(document:ClientUploadedDocument){
    const deadline=window.prompt("Date limite facultative (AAAA-MM-JJ)",document.portal_deadline?.slice(0,10)||"")?.trim();if(deadline===undefined)return;setShareBusy(document.id);setFeedback("");const response=await fetch(`/api/admin/client-uploads/${document.id}/share`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({clientId,deadline:deadline?new Date(`${deadline}T23:59:59`).toISOString():null})});const result=await response.json().catch(()=>({})) as{message?:string};setShareBusy(null);setFeedback(response.ok?(result.message||"Document envoyé au client."):(result.message||"Envoi au portail impossible."));if(response.ok)router.refresh();
  }

  return <div className="space-y-6">
    <div className="grid gap-3 sm:grid-cols-3">
      <Metric value={active.length} label="documents actifs" />
      <Metric value={DOCUMENT_CATEGORIES.filter((item) => active.some((doc) => doc.category === item.value)).length} label="catégories reçues" positive />
      <Metric value={DOCUMENT_CATEGORIES.filter((item) => !active.some((doc) => doc.category === item.value)).length} label="catégories manquantes" alert />
    </div>

    <form onSubmit={submit} className="rounded-3xl border border-dashed border-gold/60 bg-gold/10 p-5 md:p-6">
      <div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gold text-navy"><UploadCloud className="h-5 w-5" /></span><div><h3 className="font-black text-navy">{replace ? `Remplacer « ${replace.file_name} »` : "Ajouter un document"}</h3><p className="mt-1 text-sm text-navy/55">PDF, JPG, PNG ou Word · 15 Mo maximum</p></div></div>
      <div className="mt-5 grid gap-3 md:grid-cols-[1fr_0.75fr_auto] md:items-end">
        <label className="text-xs font-black uppercase tracking-wider text-navy/55">Fichier<input name="file" type="file" accept={DOCUMENT_ACCEPT} required className="mt-2 block w-full rounded-2xl border border-navy/10 bg-white p-3 text-sm normal-case tracking-normal" /></label>
        <label className="text-xs font-black uppercase tracking-wider text-navy/55">Catégorie<select key={replace?.id || "new"} name="category" defaultValue={replace?.category || "identite"} className="mt-2 block w-full rounded-2xl border border-navy/10 bg-white p-3 text-sm normal-case tracking-normal">{DOCUMENT_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <button disabled={busy} className="rounded-full bg-canada px-5 py-3 font-black text-white transition hover:bg-navy disabled:opacity-50">{busy ? "Envoi…" : replace ? "Remplacer" : "Téléverser"}</button>
      </div>
      {replace ? <button type="button" onClick={() => setReplace(null)} className="mt-3 text-sm font-black text-navy/55">Annuler le remplacement</button> : null}
      {feedback ? <p role="status" className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-navy">{feedback}</p> : null}
    </form>

    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-navy/35" /><span className="sr-only">Rechercher</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un document…" className="w-full rounded-full border border-navy/10 bg-ivory py-3 pl-11 pr-4 text-sm" /></label>
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filtrer par catégorie" className="rounded-full border border-navy/10 bg-white px-4 py-3 text-sm font-bold text-navy"><option value="all">Toutes les catégories</option>{DOCUMENT_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
      </div>
      <div className="space-y-3">{filtered.length ? filtered.map((document) => <DocumentRow key={document.id} document={document} analysis={analyses.find(item=>item.upload_id===document.id)} clientId={clientId} sharing={shareBusy===document.id} onShare={()=>void share(document)} onReplace={() => setReplace(document)} onRemove={() => remove(document)} />) : <p className="rounded-2xl bg-ivory p-5 text-sm font-bold text-navy/52">Aucun document ne correspond à cette vue.</p>}</div>
    </div>

    <div><h3 className="mb-3 flex items-center gap-2 font-black text-navy"><Check className="h-4 w-4 text-emerald-600" /> État du dossier documentaire</h3><div className="grid gap-2 md:grid-cols-2">{DOCUMENT_CATEGORIES.map((item) => { const count = active.filter((doc) => doc.category === item.value).length; return <div key={item.value} className={`flex items-center justify-between rounded-2xl p-4 ${count ? "bg-emerald-50 text-emerald-900" : "bg-canada/5 text-navy/60"}`}><span className="font-bold">{item.label}</span><span className={`rounded-full px-3 py-1 text-xs font-black ${count ? "bg-emerald-100" : "bg-canada/10 text-canada"}`}>{count ? `${count} reçu${count > 1 ? "s" : ""}` : "Manquant"}</span></div>; })}</div></div>

    {documents.some((item) => item.status !== "active") ? <details className="rounded-2xl border border-navy/10 p-4"><summary className="flex cursor-pointer list-none items-center gap-2 font-black text-navy/65"><History className="h-4 w-4" /> Historique des versions ({documents.filter((item) => item.status !== "active").length})</summary><div className="mt-3 space-y-2">{documents.filter((item) => item.status !== "active").map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-ivory p-3 text-sm text-navy/55"><span>{item.file_name} · v{item.version} · {item.status === "replaced" ? "Remplacé" : "Supprimé"}</span>{item.status === "replaced" ? <button type="button" onClick={() => restore(item)} className="shrink-0 rounded-full bg-navy px-3 py-2 text-xs font-black text-white">Restaurer</button> : null}</div>)}</div></details> : null}
  </div>;
}

function Metric({ value, label, positive, alert }: { value: number; label: string; positive?: boolean; alert?: boolean }) { return <div className={`rounded-2xl p-4 ${positive ? "bg-emerald-50" : alert ? "bg-canada/5" : "bg-ivory"}`}><strong className="block text-2xl text-navy">{value}</strong><span className="text-xs font-black uppercase tracking-wider text-navy/45">{label}</span></div>; }

function DocumentRow({ document,analysis, clientId,sharing,onShare, onReplace, onRemove }: { document: ClientUploadedDocument;analysis?:DocumentAnalysis; clientId: string;sharing:boolean;onShare:()=>void; onReplace: () => void; onRemove: () => void }) {
  const previewable = document.file_type === "application/pdf" || document.file_type?.startsWith("image/");
  const url = `/api/admin/client-uploads/${document.id}/download?clientId=${clientId}`;
  return <article className="flex flex-col gap-4 rounded-2xl border border-navy/8 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
    <div className="flex min-w-0 items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-navy/5 text-canada"><FileText className="h-5 w-5" /></span><div className="min-w-0"><p className="truncate font-black text-navy">{document.file_name}</p><p className="mt-1 text-xs font-bold text-navy/45">{documentCategoryLabel(document.category)} · v{document.version || 1} · {formatDateFr(document.created_at)}</p><p className="mt-1 text-xs text-navy/40">Ajouté par {document.uploaded_by || "Client"}{document.file_size ? ` · ${(document.file_size / 1024 / 1024).toFixed(1)} Mo` : ""}</p>{analysis?<div className="mt-2 rounded-xl bg-gold/10 px-3 py-2 text-xs text-navy/65"><strong>Analyse Julie : {analysis.detected_type||"À vérifier"}</strong><span className="ml-2">{analysis.confidence!=null?`${Math.round(Number(analysis.confidence)*100)} %`:""}</span>{analysis.summary?<p className="mt-1">{analysis.summary}</p>:null}</div>:null}</div></div>
    <div className="flex shrink-0 flex-wrap gap-2">{previewable ? <a href={`${url}&disposition=inline`} target="_blank" rel="noreferrer" title="Prévisualiser" aria-label={`Prévisualiser ${document.file_name}`} className="action"><Eye className="h-4 w-4" /></a> : null}<a href={url} title="Télécharger" aria-label={`Télécharger ${document.file_name}`} className="action"><Download className="h-4 w-4" /></a><button type="button" disabled={sharing} onClick={onShare} title="Envoyer au client" aria-label={`Envoyer ${document.file_name} au client`} className="action disabled:opacity-40"><Send className="h-4 w-4" /></button><button type="button" onClick={onReplace} title="Remplacer" aria-label={`Remplacer ${document.file_name}`} className="action"><RefreshCw className="h-4 w-4" /></button><button type="button" onClick={onRemove} title="Supprimer" aria-label={`Supprimer ${document.file_name}`} className="grid h-10 w-10 place-items-center rounded-full bg-canada/10 text-canada hover:bg-canada hover:text-white"><Trash2 className="h-4 w-4" /></button></div>
  </article>;
}
