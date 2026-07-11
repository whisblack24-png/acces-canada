"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Edit3, FilePlus2, Trash2 } from "lucide-react";

export function ClientDossierActions({ clientId, clientName }: { clientId: string; clientName: string }) {
  const router = useRouter();

  async function removeClient() {
    if (!window.confirm(`Supprimer le dossier de ${clientName} ?`)) return;

    const response = await fetch(`/api/admin/clients/${clientId}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (!response.ok) {
      const result = (await response.json().catch(() => ({}))) as { message?: string };
      window.alert(result.message || "Impossible de supprimer le client.");
      return;
    }

    router.push("/admin/clients");
    router.refresh();
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
          className="inline-flex items-center justify-center gap-2 rounded-full border border-canada/25 bg-canada/10 px-5 py-3 text-sm font-black text-canada transition hover:bg-canada hover:text-white"
        >
          <Trash2 className="h-4 w-4" />
          Supprimer
        </button>
      </div>

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
