"use client";

import { useRouter } from "next/navigation";
import { Download, Trash2 } from "lucide-react";
import type { ClientUploadedDocument } from "@/lib/client-portal";
import { formatDateFr } from "@/lib/format";

export function ClientUploadedDocumentsAdmin({
  clientId,
  documents,
}: {
  clientId: string;
  documents: ClientUploadedDocument[];
}) {
  const router = useRouter();

  async function remove(document: ClientUploadedDocument) {
    if (!window.confirm(`Supprimer ${document.file_name} ?`)) return;

    const response = await fetch(`/api/admin/client-uploads/${document.id}?clientId=${clientId}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (!response.ok) {
      const result = (await response.json().catch(() => ({}))) as { message?: string };
      window.alert(result.message || "Impossible de supprimer ce document.");
      return;
    }

    router.refresh();
  }

  if (!documents.length) {
    return <p className="rounded-2xl bg-ivory p-4 text-sm font-bold text-navy/52">Aucun document envoyé par le client.</p>;
  }

  return (
    <div className="space-y-2">
      {documents.map((document) => (
        <div key={document.id} className="flex items-center justify-between gap-3 rounded-2xl bg-ivory p-4 font-bold text-navy/74">
          <span className="min-w-0">
            <span className="block truncate">{document.file_name}</span>
            <span className="mt-1 block text-xs text-navy/42">
              {formatDateFr(document.created_at)}
              {document.file_size ? ` - ${(document.file_size / 1024).toFixed(1)} Ko` : ""}
            </span>
          </span>
          <span className="flex shrink-0 gap-2">
            <a
              href={`/api/admin/client-uploads/${document.id}/download?clientId=${clientId}`}
              aria-label="Télécharger"
              title="Télécharger"
              className="grid h-9 w-9 place-items-center rounded-full bg-gold/20 text-navy transition hover:bg-gold"
            >
              <Download className="h-4 w-4" />
            </a>
            <button
              type="button"
              onClick={() => remove(document)}
              aria-label="Supprimer"
              title="Supprimer"
              className="grid h-9 w-9 place-items-center rounded-full bg-canada/10 text-canada transition hover:bg-canada hover:text-white"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}
