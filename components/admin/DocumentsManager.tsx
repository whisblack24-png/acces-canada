"use client";

import { FormEvent, useMemo, useState } from "react";
import { Download, FilePlus2, Trash2 } from "lucide-react";
import type { AdminClient, ServiceType } from "@/lib/admin-data";
import { serviceLabels } from "@/lib/admin-data";
import type { GeneratedDocument } from "@/lib/admin-documents";
import { caseDocumentRecommendations, documentLibrary, immigrationCaseLabels } from "@/lib/pdf-documents";
import type { ClientDocumentType, DocumentGenerationOptions, ImmigrationCaseType } from "@/lib/pdf-documents";
import { formatDateFr } from "@/lib/format";

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
  { key: "includeContactInfo", label: "Coordonnées" },
  { key: "includeServiceInfo", label: "Service et statut" },
  { key: "includeDocuments", label: "Documents reçus / manquants" },
  { key: "includeNotes", label: "Notes internes" },
  { key: "includePayments", label: "Paiements" },
];

export function DocumentsManager({
  clients,
  initialDocuments,
  initialClientId,
}: {
  clients: AdminClient[];
  initialDocuments: GeneratedDocument[];
  initialClientId?: string;
}) {
  const [clientId, setClientId] = useState(initialClientId || clients[0]?.id || "");
  const [documentType, setDocumentType] = useState<ClientDocumentType>("convention");
  const [caseType, setCaseType] = useState<ImmigrationCaseType>("visa_visiteur");
  const [options, setOptions] = useState<DocumentGenerationOptions>(defaultOptions);
  const [documents, setDocuments] = useState(initialDocuments);
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedClient = useMemo(() => clients.find((client) => client.id === clientId) || null, [clients, clientId]);
  const selectedDocument = documentLibrary.find((document) => document.type === documentType);
  const recommendedTypes=caseDocumentRecommendations[caseType];
  const recommendedDocuments=documentLibrary.filter(document=>recommendedTypes.includes(document.type));
  const otherDocuments=documentLibrary.filter(document=>!recommendedTypes.includes(document.type));
  const filteredDocuments = useMemo(
    () => (clientId ? documents.filter((document) => document.client_id === clientId) : documents),
    [clientId, documents],
  );

  async function refreshHistory() {
    const response = await fetch("/api/admin/documents", { credentials: "include" });
    const result = (await response.json().catch(() => ({}))) as { documents?: GeneratedDocument[] };
    setDocuments(result.documents || []);
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!clientId) {
      setFeedback("Sélectionnez un client avant de générer un document.");
      return;
    }

    setLoading(true);
    setFeedback("");

    const response = await fetch("/api/admin/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ client_id: clientId, document_type: documentType, included_information: { ...options, caseType } }),
    });
    const result = (await response.json().catch(() => ({}))) as { document?: GeneratedDocument; message?: string };
    setLoading(false);

    if (!response.ok || !result.document) {
      setFeedback(result.message || "Impossible de générer le document.");
      return;
    }

    setFeedback("Document généré avec succès.");
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

    setFeedback("Document supprimé de l'historique.");
    await refreshHistory();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-[2rem] bg-white p-5 shadow-premium md:p-7">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-canada">Génération automatique</p>
        <h2 className="mt-2 font-display text-3xl font-black text-navy">Générer un document</h2>

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
            Type de dossier
            <select value={caseType} onChange={(event)=>{const value=event.target.value as ImmigrationCaseType;setCaseType(value);setDocumentType("convention");}} className="mt-2 w-full rounded-2xl border border-navy/10 bg-ivory px-4 py-3 text-navy outline-none focus:border-gold">
              {(Object.entries(immigrationCaseLabels) as [ImmigrationCaseType,string][]).map(([value,label])=><option key={value} value={value}>{label}</option>)}
            </select>
            <span className="mt-2 block text-xs font-semibold text-navy/45">La documentation recommandée est adaptée automatiquement à ce type de dossier.</span>
          </label>

          <label className="block text-sm font-bold text-navy/70">
            Type de document
            <select
              value={documentType}
              onChange={(event) => setDocumentType(event.target.value as ClientDocumentType)}
              className="mt-2 w-full rounded-2xl border border-navy/10 bg-ivory px-4 py-3 text-navy outline-none focus:border-gold"
            >
              <optgroup label={`Recommandés — ${immigrationCaseLabels[caseType]}`}>
              {recommendedDocuments.map((document) => (
                <option key={document.type} value={document.type}>
                  {document.label}
                </option>
              ))}
              </optgroup>
              <optgroup label="Autres modèles disponibles">
              {otherDocuments.map((document) => <option key={document.type} value={document.type}>{document.label}</option>)}
              </optgroup>
            </select>
          </label>

          <div className="rounded-2xl border border-navy/10 bg-ivory p-4">
            <p className="text-xs font-black uppercase tracking-[.16em] text-canada">Documentation recommandée</p>
            <div className="mt-3 flex flex-wrap gap-2">{recommendedDocuments.map(document=><button type="button" key={document.type} onClick={()=>setDocumentType(document.type)} className={`rounded-full px-3 py-2 text-xs font-black transition ${document.type===documentType?"bg-navy text-white":"bg-white text-navy hover:bg-gold/25"}`}>{document.label}</button>)}</div>
            <p className="mt-3 text-xs leading-5 text-navy/50">Les questionnaires intelligents du client et du garant restent accessibles depuis la fiche client et complètent automatiquement ces documents.</p>
          </div>

          <div className="rounded-[1.5rem] bg-navy p-5 text-white">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-gold">Informations à inclure</p>
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
            <p className="mt-4 rounded-2xl border border-gold/30 bg-gold/10 px-4 py-3 text-xs font-bold leading-6 text-white/85">
              Les signatures officielles, la date, le cachet, le QR Code et l’empreinte d’authenticité sont toujours ajoutés automatiquement.
            </p>
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
            {loading ? "Génération..." : "Générer le document"}
          </button>
        </form>
      </section>

      <section className="rounded-[2rem] bg-white p-5 shadow-premium md:p-7">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-canada">Historique</p>
            <h2 className="mt-2 font-display text-3xl font-black text-navy">Documents générés</h2>
          </div>
          <span className="w-fit rounded-full bg-gold/20 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-navy">
            {filteredDocuments.length} document{filteredDocuments.length > 1 ? "s" : ""}
          </span>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-navy/10">
          <div className="hidden grid-cols-[1fr_0.9fr_0.7fr_0.45fr] bg-navy px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-white/70 md:grid">
            <span>Client</span>
            <span>Document</span>
            <span>Date</span>
            <span className="text-right">Actions</span>
          </div>

          {filteredDocuments.length ? (
            filteredDocuments.map((document) => (
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
                  {formatDateFr(document.created_at)}
                </span>
                <span className="flex justify-start gap-2 md:justify-end">
                  <a
                    href={`/api/admin/documents/${document.id}/download`}
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
            ))
          ) : (
            <p className="px-4 py-8 text-center text-sm font-bold text-navy/50">Aucun document généré pour ce client.</p>
          )}
        </div>
      </section>
    </div>
  );
}
