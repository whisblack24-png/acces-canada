"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Edit3, Trash2 } from "lucide-react";

const documents = [
  { label: "Convention de services", type: "convention" },
  { label: "Reconnaissance de dette", type: "reconnaissance-dette" },
  { label: "Liste de verification visa", type: "checklist-visa" },
  { label: "Facture client", type: "facture" },
];

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
        <p className="text-xs font-black uppercase tracking-[0.18em] text-navy/52">Generer PDF</p>
        <div className="mt-3 grid gap-2">
          {documents.map((document) => (
            <a
              key={document.type}
              href={`/api/admin/clients/${clientId}/documents/${document.type}`}
              className="inline-flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 text-sm font-black text-navy shadow-sm transition hover:bg-navy hover:text-white"
            >
              {document.label}
              <Download className="h-4 w-4" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
