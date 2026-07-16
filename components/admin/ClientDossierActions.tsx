"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Edit3, FilePlus2, Trash2 } from "lucide-react";

export function ClientDossierActions({ clientId, clientName }: { clientId: string; clientName: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function removeClient() {
    if (deleting) return;
    if (!window.confirm(`Supprimer le dossier de ${clientName} ?`)) return;

    setDeleting(true);
    setFeedback("");
    try {
      const response = await fetch(`/api/admin/clients/${clientId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const result = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        setFeedback(result.message || "La suppression du client n’a pas pu être terminée. Aucune donnée n’a été supprimée. Veuillez réessayer.");
        return;
      }

      router.push("/admin/clients?deleted=1");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/admin/clients"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-navy px-5 py-3 text-sm font-black text-white transition hover:bg-canada"
        >
          <Edit3 className="h-4 w-4" />
          Modifier
        </Link>
        <button
          type="button"
          onClick={removeClient}
          disabled={deleting}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-canada/25 bg-canada/10 px-5 py-3 text-sm font-black text-canada transition hover:bg-canada hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
          {deleting ? "Suppression..." : "Supprimer"}
        </button>
      </div>

      {feedback ? <p role="alert" className="rounded-2xl bg-canada/10 px-4 py-3 text-sm font-bold text-canada">{feedback}</p> : null}

      <div className="rounded-[1.5rem] border border-gold/25 bg-gold/10 p-4">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-navy/52">Documents automatiques</p>
        <p className="mt-2 text-sm font-bold leading-6 text-navy/66">
          Créez une convention, une facture, un reçu, une reconnaissance de dette, une checklist ou une lettre explicative à partir de ce dossier.
        </p>
        <Link
          href={`/admin/documents/generation?clientId=${clientId}`}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gold px-5 py-3 text-sm font-black text-navy transition hover:bg-navy hover:text-white"
        >
          <FilePlus2 className="h-4 w-4" />
          Générer un document
        </Link>
      </div>
    </div>
  );
}
