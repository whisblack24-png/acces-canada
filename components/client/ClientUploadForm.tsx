"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, RefreshCw, Trash2, UploadCloud } from "lucide-react";
import type { ClientUploadedDocument } from "@/lib/client-portal";
import { formatDateFr } from "@/lib/format";
import { DOCUMENT_ACCEPT, DOCUMENT_CATEGORIES } from "@/lib/document-categories";

export function ClientUploadForm({ initialUploads }: { initialUploads: ClientUploadedDocument[] }) {
  const router = useRouter();
  const [uploads, setUploads] = useState(initialUploads);
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [replaceId, setReplaceId] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    if (replaceId) formData.set("replaceId", replaceId);
    setLoading(true);
    setFeedback("");

    const response = await fetch("/api/client/uploads", { method: "POST", credentials: "include", body: formData });
    const result = (await response.json().catch(() => ({}))) as { upload?: ClientUploadedDocument; message?: string };
    setLoading(false);

    if (!response.ok || !result.upload) {
      setFeedback(result.message || "Impossible d'envoyer le fichier.");
      return;
    }

    setUploads((current) => [result.upload!, ...current.filter((item) => item.id !== replaceId)]);
    setFeedback(replaceId ? "Nouvelle version enregistrée avec succès." : "Document envoyé avec succès.");
    setReplaceId("");
    form.reset();
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="rounded-[1.5rem] border border-gold/25 bg-gold/10 p-5">
        <label className="block text-sm font-bold text-navy/70">
          {replaceId ? "Sélectionner la nouvelle version" : "Ajouter un document PDF, JPG, PNG ou Word"}
          <input
            name="file"
            type="file"
            accept={DOCUMENT_ACCEPT}
            required
            className="mt-3 w-full rounded-2xl border border-navy/10 bg-white px-4 py-3 text-navy"
          />
        </label>
        <label className="mt-4 block text-sm font-bold text-navy/70">Catégorie
          <select name="category" className="mt-2 w-full rounded-2xl border border-navy/10 bg-white px-4 py-3 text-navy">
            {DOCUMENT_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        {feedback ? <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-navy">{feedback}</p> : null}
        <button type="submit" disabled={loading} className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-canada px-5 py-3 text-sm font-black text-white transition hover:bg-navy disabled:bg-navy/35">
          <UploadCloud className="h-4 w-4" />
          {loading ? "Envoi..." : replaceId ? "Remplacer le document" : "Envoyer le document"}
        </button>
        {replaceId ? <button type="button" onClick={() => setReplaceId("")} className="ml-3 text-sm font-black text-navy/55">Annuler</button> : null}
      </form>

      <div className="space-y-3">
        {uploads.length ? (
          uploads.map((upload) => (
            <div key={upload.id} className="flex flex-col gap-3 rounded-2xl bg-ivory p-4 font-bold text-navy/74 sm:flex-row sm:items-center sm:justify-between">
              <span>
                <span className="block">{upload.file_name}</span>
                <span className="mt-1 block text-xs text-navy/42">{formatDateFr(upload.created_at)} · {upload.category || "autre"} · version {upload.version || 1}</span>
              </span>
              <span className="flex flex-wrap gap-2">
                <a href={`/api/client/uploads/${upload.id}/download`} className="rounded-full bg-white p-2" aria-label={`Télécharger ${upload.file_name}`}><Download className="h-4 w-4" /></a>
                <button type="button" onClick={() => setReplaceId(upload.id)} className="rounded-full bg-gold/20 p-2" aria-label={`Remplacer ${upload.file_name}`}><RefreshCw className="h-4 w-4" /></button>
                <button type="button" onClick={() => remove(upload.id)} className="rounded-full bg-canada/10 p-2 text-canada" aria-label={`Supprimer ${upload.file_name}`}><Trash2 className="h-4 w-4" /></button>
              </span>
            </div>
          ))
        ) : (
          <p className="rounded-2xl bg-ivory p-4 text-sm font-bold text-navy/52">Aucun document envoyé pour le moment.</p>
        )}
      </div>
    </div>
  );

  async function remove(id: string) {
    if (!window.confirm("Supprimer ce document de votre espace client ?")) return;
    const response = await fetch(`/api/client/uploads/${id}`, { method: "DELETE" });
    if (!response.ok) { setFeedback("Suppression impossible."); return; }
    setUploads((current) => current.filter((upload) => upload.id !== id));
    setFeedback("Document supprimé. Son historique reste conservé dans le dossier.");
    router.refresh();
  }
}
