"use client";

import { FormEvent, useState } from "react";
import { CreditCard, FileSignature } from "lucide-react";
import { documentLibrary, type ClientDocumentType } from "@/lib/pdf-documents";

export function ClientProductionActions({ clientId }: { clientId: string }) {
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);

  async function requestSignature(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setLoading(true);
    setFeedback("");

    const response = await fetch(`/api/admin/clients/${clientId}/signatures`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ documentType: formData.get("documentType") as ClientDocumentType }),
    });
    const result = (await response.json().catch(() => ({}))) as { message?: string };
    setLoading(false);
    setFeedback(response.ok ? "Demande de signature envoyée au client." : result.message || "Action impossible.");
  }

  async function createPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const amount = Math.round(Number(formData.get("amount") || 0) * 100);
    setLoading(true);
    setFeedback("");

    const response = await fetch(`/api/admin/clients/${clientId}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        amountCents: amount,
        description: formData.get("description") || "Paiement Accès Canada",
      }),
    });
    const result = (await response.json().catch(() => ({}))) as { payment?: { checkout_url?: string }; message?: string };
    setLoading(false);
    if (!response.ok) {
      setFeedback(result.message || "Paiement impossible.");
      return;
    }
    setFeedback("Lien de paiement créé. Le client peut payer depuis son espace sécurisé.");
  }

  return (
    <div className="space-y-4">
      {feedback ? <p className="rounded-2xl bg-gold/15 px-4 py-3 text-sm font-bold text-navy">{feedback}</p> : null}

      <form onSubmit={requestSignature} className="rounded-2xl bg-ivory p-4">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-navy/42">Signature électronique</p>
        <select
          name="documentType"
          className="mt-3 w-full rounded-2xl border border-navy/10 bg-white px-4 py-3 text-sm font-bold text-navy outline-none focus:border-gold"
        >
          {documentLibrary.map((document) => (
            <option key={document.type} value={document.type}>
              {document.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={loading}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-navy px-5 py-3 text-sm font-black text-white transition hover:bg-canada disabled:bg-navy/35"
        >
          <FileSignature className="h-4 w-4" />
          Demander la signature
        </button>
      </form>

      <form onSubmit={createPayment} className="rounded-2xl bg-ivory p-4">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-navy/42">Paiement Stripe</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[0.55fr_1fr]">
          <input
            name="amount"
            type="number"
            min="1"
            step="0.01"
            required
            placeholder="Montant"
            className="rounded-2xl border border-navy/10 bg-white px-4 py-3 text-sm font-bold text-navy outline-none focus:border-gold"
          />
          <input
            name="description"
            defaultValue="Paiement Accès Canada"
            className="rounded-2xl border border-navy/10 bg-white px-4 py-3 text-sm font-bold text-navy outline-none focus:border-gold"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-canada px-5 py-3 text-sm font-black text-white transition hover:bg-navy disabled:bg-navy/35"
        >
          <CreditCard className="h-4 w-4" />
          Créer un lien de paiement
        </button>
      </form>
    </div>
  );
}
