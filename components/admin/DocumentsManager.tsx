"use client";

import { FormEvent, useMemo, useState } from "react";
import { Download, FilePlus2, Trash2 } from "lucide-react";
import type { AdminClient, ServiceType } from "@/lib/admin-data";
import { serviceLabels } from "@/lib/admin-data";
import type { GeneratedDocument } from "@/lib/admin-documents";
import { documentLibrary } from "@/lib/pdf-documents";
import type { ClientDocumentType, DocumentGenerationOptions } from "@/lib/pdf-documents";

const defaultOptions: DocumentGenerationOptions = {
  includePersonalInfo: true,
  includeContactInfo: true,
  includeServiceInfo: true,
  includeDocuments: true,
  includeNotes: true,
  includePayments: true,
  includeSignatures: true,
};

const optionLabels: { key: keyof DocumentGenerationOptions; label: string }[] = [
  { key: "includePersonalInfo", label: "Informations personnelles" },
  { key: "includeContactInfo", label: "Coordonnees" },
  { key: "includeServiceInfo", label: "Service et statut" },
  { key: "includeDocuments", label: "Documents recus / manquants" },
  { key: "includeNotes", label: "Notes internes" },
  { key: "includePayments", label: "Paiements" },
  { key: "includeSignatures", label: "Signatures" },
];

export function DocumentsManager({
  clients,
  initialDocuments,
}: {
  clients: AdminClient[];
  initialDocuments: GeneratedDocument[];
}) {
  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [documentType, setDocumentType] = useState<ClientDocumentType>("convention");
  const [options, setOptions] = useState<DocumentGenerationOptions>(defaultOptions);
  const [documents, setDocuments] = useState(initialDocuments);
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedClient = useMemo(() => clients.find((client) => client.id === clientId) || null, [clients, clientId]);
  const selectedDocument = documentLibrary.find((document) => document.type === documentType);

  async function refreshHistory() {
    const response = await fetch("/api/admin/documents", { credentials: "include" });
    const result = (await response.json().catch(() => ({}))) as { documents?: GeneratedDocument[] };
    setDocuments(result.documents || []);
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!clientId) {
      setFeedback("Selectionnez un client avant de generer un document.");
      return;
    }

    setLoading(true);
    setFeedback("");

    const response = await fetch("/api/admin/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ client_id: clientId, document_type: documentType, included_information: options }),
    });
    const result = (await response.json().catch(() => ({}))) as { document?: GeneratedDocument; message?: string };
    setLoading(false);

    if (!response.ok || !result.document) {
      setFeedback(result.message || "Impossible de generer le document.");
      return;
    }

    setFeedback("Document genere avec succes.");
    window.open(`/api/admin/documents/${result.document.id}/download`, "_blank", "noopener,noreferrer");
    await refreshHistory();
  }

  async function remove(document: GeneratedDocument) {
    if (!window.confirm(`Supprimer ${document.document_label} pour ${document.client_name} ?`)) return;

    const response = await fetch(`/api/admin/documents/${document.id}`, { method: "DELETE", credentials: "include" });
    if (!response.ok) {
      const result = (await response.json().catch(() => ({}))) as { message?: string };
      setFeedback(result.message || "Impossible de supprimer ce document.");
      return;
    }

    setFeedback("Document supprime de l'historique.");
    await refreshHistory();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-[2rem] bg-white p-5 shadow-premium md:p-7">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-canada">Generation</p>
        <h2 className="mt-2 font-display text-3xl font-black text-navy">Nouveau document</h2>

        <form onSubmit={generate} className="mt-6 space-y-5">
          <label className="block text-sm font-bold text-navy/70">
            Client
            <select
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-navy/10 bg-ivory px-4 py-3 text-navy outline-none focus:border-gold"
            >
              {clients.length ? null : <option value="">Aucun client disponible</option>}
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.full_name} - {serviceLabels[client.service as ServiceType] || client.service}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-bold text-navy/70">
            Type de document
            <select
              value={documentType}
              onChange={(event) => setDocumentType(event.target.value as ClientDocumentType)}
              className="mt-2 w-full rounded-2xl border border-navy/10 bg-ivory px-4 py-3 text-navy outline-none focus:border-gold"
            >
              {documentLibrary.map((document) => (
                <option key={document.type} value={document.type}>
                  {document.label}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-[1.5rem] bg-navy p-5 text-white">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-gold">Informations a inclure</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {optionLabels.map((option) => (
                <label key={option.key} className="flex items-center gap-3 rounded-2xl bg-white/8 px-4 py-3 text-sm font-bold">
                  <input
                    type="checkbox"
                    checked={Boolean(options[option.key])}
                    onChange={(event) => setOptions({ ...options, [option.key]: event.target.checked })}
                    className="h-4 w-4 accent-gold"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>

          {selectedClient || selectedDocument ? (
            <div className="rounded-2xl border border-gold/25 bg-gold/10 p-4 text-sm leading-7 text-navy/70">
              <p className="font-black text-navy">{selectedDocument?.label}</p>
              <p>{selectedDocument?.description}</p>
              {selectedClient ? <p className="mt-2 font-bold">Client : {selectedClient.full_name}</p> : null}
            </div>
          ) : null}

          {feedback ? <p className="rounded-2xl bg-gold/15 px-4 py-3 text-sm font-bold text-navy">{feedback}</p> : null}

          <button
            type="submit"
            disabled={loading || !clients.length}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-canada px-5 py-3 text-sm font-black text-white transition hover:bg-navy disabled:bg-navy/35"
          >
            <FilePlus2 className="h-4 w-4" />
            {loading ? "Generation..." : "Generer le document"}
          </button>
        </form>
      </section>

      <section className="rounded-[2rem] bg-white p-5 shadow-premium md:p-7">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-canada">Historique</p>
            <h2 className="mt-2 font-display text-3xl font-black text-navy">Documents generes</h2>
          </div>
          <span className="w-fit rounded-full bg-gold/20 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-navy">
            {documents.length} document{documents.length > 1 ? "s" : ""}
          </span>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-navy/10">
          <div className="hidden grid-cols-[1fr_0.9fr_0.7fr_0.45fr] bg-navy px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-white/70 md:grid">
            <span>Client</span>
            <span>Document</span>
            <span>Date</span>
            <span className="text-right">Actions</span>
          </div>

          {documents.length ? (
            documents.map((document) => (
              <div
                key={document.id}
                className="grid grid-cols-1 gap-3 border-t border-navy/10 px-4 py-4 md:grid-cols-[1fr_0.9fr_0.7fr_0.45fr] md:items-center"
              >
                <span>
                  <span className="block font-black text-navy">{document.client_name}</span>
                  <span className="mt-1 block text-xs font-bold text-navy/44">{document.file_name}</span>
                </span>
                <span className="text-sm font-bold text-navy/68">{document.document_label}</span>
                <span className="text-sm font-bold text-navy/52">
                  {new Date(document.created_at).toLocaleDateString("fr-CA")}
                </span>
                <span className="flex justify-start gap-2 md:justify-end">
                  <a
                    href={`/api/admin/documents/${document.id}/download`}
                    aria-label="Telecharger"
                    title="Telecharger"
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
            ))
          ) : (
            <p className="px-4 py-8 text-center text-sm font-bold text-navy/50">Aucun document genere pour le moment.</p>
          )}
        </div>
      </section>
    </div>
  );
}
