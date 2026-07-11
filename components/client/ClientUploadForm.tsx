"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud } from "lucide-react";
import type { ClientUploadedDocument } from "@/lib/client-portal";
import { formatDateFr } from "@/lib/format";

export function ClientUploadForm({ initialUploads }: { initialUploads: ClientUploadedDocument[] }) {
  const router = useRouter();
  const [uploads, setUploads] = useState(initialUploads);
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setLoading(true);
    setFeedback("");

    const response = await fetch("/api/client/uploads", { method: "POST", credentials: "include", body: formData });
    const result = (await response.json().catch(() => ({}))) as { upload?: ClientUploadedDocument; message?: string };
    setLoading(false);

    if (!response.ok || !result.upload) {
      setFeedback(result.message || "Impossible d'envoyer le fichier.");
      return;
    }

    setUploads([result.upload, ...uploads]);
    setFeedback("Document envoyé avec succès.");
    form.reset();
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="rounded-[1.5rem] border border-gold/25 bg-gold/10 p-5">
        <label className="block text-sm font-bold text-navy/70">
          Ajouter un document PDF, JPG ou PNG
          <input
            name="file"
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            required
            className="mt-3 w-full rounded-2xl border border-navy/10 bg-white px-4 py-3 text-navy"
          />
        </label>
        {feedback ? <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-navy">{feedback}</p> : null}
        <button type="submit" disabled={loading} className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-canada px-5 py-3 text-sm font-black text-white transition hover:bg-navy disabled:bg-navy/35">
          <UploadCloud className="h-4 w-4" />
          {loading ? "Envoi..." : "Envoyer le document"}
        </button>
      </form>

      <div className="space-y-3">
        {uploads.length ? (
          uploads.map((upload) => (
            <a key={upload.id} href={`/api/client/uploads/${upload.id}/download`} className="flex items-center justify-between gap-3 rounded-2xl bg-ivory p-4 font-bold text-navy/74 transition hover:bg-gold/15">
              <span>
                <span className="block">{upload.file_name}</span>
                <span className="mt-1 block text-xs text-navy/42">{formatDateFr(upload.created_at)}</span>
              </span>
              Télécharger
            </a>
          ))
        ) : (
          <p className="rounded-2xl bg-ivory p-4 text-sm font-bold text-navy/52">Aucun document envoyé pour le moment.</p>
        )}
      </div>
    </div>
  );
}
