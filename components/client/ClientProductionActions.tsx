"use client";

import { FormEvent, useState } from "react";
import { CreditCard, FileSignature } from "lucide-react";
import type { ClientPayment, ClientSignature } from "@/lib/production-workflow";
import { formatDateFr, formatUsd } from "@/lib/format";

export function ClientSignaturePanel({ initialSignatures }: { initialSignatures: ClientSignature[] }) {
  const [signatures, setSignatures] = useState(initialSignatures);
  const [feedback, setFeedback] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function sign(event: FormEvent<HTMLFormElement>, signatureId: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setLoadingId(signatureId);
    setFeedback("");

    const response = await fetch("/api/client/signatures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ signatureId, signatureText: formData.get("signatureText") }),
    });
    const result = (await response.json().catch(() => ({}))) as { signature?: ClientSignature; message?: string };
    setLoadingId(null);

    if (!response.ok || !result.signature) {
      setFeedback(result.message || "Signature impossible.");
      return;
    }

    setSignatures((current) => current.map((item) => (item.id === result.signature?.id ? result.signature : item)));
    setFeedback("Signature enregistrée avec succès.");
    form.reset();
  }

  return (
    <div className="space-y-4">
      {feedback ? <p className="rounded-2xl bg-gold/15 px-4 py-3 text-sm font-bold text-navy">{feedback}</p> : null}
      {signatures.length ? (
        signatures.map((signature) => (
          <div key={signature.id} className="rounded-2xl bg-ivory p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <span>
                <span className="block font-black text-navy">{signature.document_label}</span>
                <span className="mt-1 block text-xs font-bold text-navy/48">
                  {signature.status === "signed" ? `Signé le ${formatDateFr(signature.signed_at)}` : "Signature requise"}
                </span>
              </span>
              <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-black text-navy">
                {signature.status === "signed" ? "Signé" : "À signer"}
              </span>
            </div>
            {signature.status !== "signed" ? (
              <form onSubmit={(event) => sign(event, signature.id)} className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                <input
                  name="signatureText"
                  required
                  placeholder="Nom complet pour signature électronique"
                  className="rounded-2xl border border-navy/10 bg-white px-4 py-3 text-sm font-bold text-navy outline-none focus:border-gold"
                />
                <button
                  type="submit"
                  disabled={loadingId === signature.id}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-canada px-5 py-3 text-sm font-black text-white transition hover:bg-navy disabled:bg-navy/35"
                >
                  <FileSignature className="h-4 w-4" />
                  {loadingId === signature.id ? "Signature..." : "Signer"}
                </button>
              </form>
            ) : null}
          </div>
        ))
      ) : (
        <p className="rounded-2xl bg-ivory p-4 text-sm font-bold text-navy/52">Aucun document en attente de signature.</p>
      )}
    </div>
  );
}

export function ClientPaymentPanel({ initialPayments }: { initialPayments: ClientPayment[] }) {
  return (
    <div className="space-y-3">
      {initialPayments.length ? (
        initialPayments.map((payment) => (
          <div key={payment.id} className="flex flex-col gap-3 rounded-2xl bg-ivory p-4 md:flex-row md:items-center md:justify-between">
            <span>
              <span className="block font-black text-navy">{payment.description}</span>
              <span className="mt-1 block text-xs font-bold text-navy/48">
                {formatUsd(payment.amount_cents / 100)} - {payment.status === "paid" ? `payé le ${formatDateFr(payment.paid_at)}` : "paiement en attente"}
              </span>
            </span>
            {payment.status === "paid" ? (
              <span className="w-fit rounded-full bg-gold/20 px-3 py-1 text-xs font-black text-navy">Payé</span>
            ) : payment.checkout_url ? (
              <a
                href={payment.checkout_url}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-canada px-5 py-3 text-sm font-black text-white transition hover:bg-navy"
              >
                <CreditCard className="h-4 w-4" />
                Payer
              </a>
            ) : (
              <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-black text-navy">En attente</span>
            )}
          </div>
        ))
      ) : (
        <p className="rounded-2xl bg-ivory p-4 text-sm font-bold text-navy/52">Aucun paiement en attente.</p>
      )}
    </div>
  );
}
