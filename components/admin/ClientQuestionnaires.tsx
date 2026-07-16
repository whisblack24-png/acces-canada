"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Link2,
  Mail,
  Power,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import {
  questionnaireLabels,
  type QuestionnaireType,
} from "@/lib/questionnaire-definitions";
import type { QuestionnaireRecord } from "@/lib/questionnaires";

type Feedback = {
  type: QuestionnaireType;
  kind: "success" | "error";
  text: string;
  url?: string;
  expiresAt?: string;
  recipient?: string;
  disabled?: boolean;
};

export function ClientQuestionnaires({
  clientId,
  initialRows,
}: {
  clientId: string;
  initialRows: QuestionnaireRecord[];
}) {
  const [rows, setRows] = useState(initialRows);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState("");
  async function copy(url: string) {
    await navigator.clipboard.writeText(url);
    setFeedback((current) =>
      current
        ? {
            ...current,
            kind: "success",
            text: "Lien copié dans le presse-papiers.",
          }
        : current,
    );
  }
  async function action(
    type: QuestionnaireType,
    operation: "generate" | "disable",
    email = false,
  ) {
    if (
      operation === "disable" &&
      !window.confirm(
        "Désactiver ce lien public ? Les réponses déjà enregistrées seront conservées.",
      )
    )
      return;
    setBusy(type);
    setFeedback(null);
    try {
      const response = await fetch(
        `/api/admin/clients/${clientId}/questionnaires`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, operation, email }),
        },
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Action impossible.");
      if (body.rows) setRows(body.rows);
      if (body.url) {
        const copied = await navigator.clipboard
          .writeText(body.url)
          .then(() => true)
          .catch(() => false);
        setFeedback({
          type,
          kind: "success",
          text: email
            ? `Courriel envoyé avec succès à ${body.recipientEmail}.`
            : copied
              ? "Lien créé et copié avec succès."
              : "Lien créé. Utilisez le bouton Copier le lien.",
          url: body.url,
          expiresAt: body.expiresAt,
          recipient: body.recipientEmail,
        });
      } else
        setFeedback({
          type,
          kind: "success",
          text: "Lien public désactivé. Les réponses sont conservées.",
          disabled: true,
        });
    } catch (error) {
      setFeedback({
        type,
        kind: "error",
        text:
          error instanceof Error ? error.message : "Une erreur est survenue.",
      });
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="space-y-4">
      {rows.map((row) => {
        const notice =
          feedback?.type === row.questionnaire_type ? feedback : null;
        return (
          <article
            key={row.id}
            className="rounded-2xl border border-navy/10 p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-black text-navy">
                  {questionnaireLabels[row.questionnaire_type]}
                </h3>
                <p className="mt-1 text-xs font-bold text-navy/45">
                  {row.status === "completed"
                    ? "Complété"
                    : row.status === "in_progress"
                      ? "En cours"
                      : "Brouillon"} ·{" "}
                  {row.progress_percent} % · Modifié{" "}
                  {new Date(row.updated_at).toLocaleString("fr-CA")}
                </p>
                {row.submitted_at && (
                  <p className="mt-1 text-xs font-bold text-emerald-700">
                    Soumis le{" "}
                    {new Date(row.submitted_at).toLocaleString("fr-CA")}
                  </p>
                )}
              </div>
              <span className="rounded-full bg-ivory px-3 py-2 text-xs font-black text-navy">
                {row.progress_percent} %
              </span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-navy/8">
              <div
                className="h-full bg-gold"
                style={{ width: `${row.progress_percent}%` }}
              />
            </div>
            {notice && (
              <div
                role="status"
                className={`mt-5 rounded-2xl border p-5 ${notice.kind === "error" ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}
              >
                <div className="flex gap-3">
                  {notice.kind === "error" ? (
                    <TriangleAlert className="h-6 w-6 shrink-0 text-red-700" />
                  ) : (
                    <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-700" />
                  )}
                  <div className="min-w-0">
                    <p
                      className={`font-black ${notice.kind === "error" ? "text-red-800" : "text-emerald-800"}`}
                    >
                      {notice.text}
                    </p>
                    {notice.recipient && (
                      <p className="mt-1 text-sm font-bold text-navy/60">
                        Destinataire : {notice.recipient}
                      </p>
                    )}
                    {notice.expiresAt && (
                      <p className="mt-1 text-sm text-navy/55">
                        Expiration :{" "}
                        {new Date(notice.expiresAt).toLocaleString("fr-CA")}
                      </p>
                    )}
                  </div>
                </div>
                {notice.url && (
                  <>
                    <div className="mt-4 break-all rounded-xl border border-navy/10 bg-white p-3 font-mono text-xs text-navy">
                      {notice.url}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => void copy(notice.url!)}
                        className="inline-flex items-center gap-2 rounded-full bg-navy px-4 py-2 text-xs font-black text-white"
                      >
                        <Copy className="h-4 w-4" />
                        Copier le lien
                      </button>
                      <a
                        href={notice.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-full bg-gold px-4 py-2 text-xs font-black text-navy"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Ouvrir le questionnaire
                      </a>
                    </div>
                    <p className="mt-3 flex items-start gap-2 text-xs font-bold text-navy/55">
                      <ShieldCheck className="h-4 w-4 shrink-0" />
                      Toute régénération invalide automatiquement le lien
                      précédent.
                    </p>
                  </>
                )}
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                disabled={busy === row.questionnaire_type}
                onClick={() => void action(row.questionnaire_type, "generate")}
                className="inline-flex items-center gap-2 rounded-full bg-navy px-4 py-2 text-xs font-black text-white disabled:opacity-50"
              >
                <Link2 className="h-4 w-4" />
                {busy === row.questionnaire_type
                  ? "Traitement…"
                  : "Générer / régénérer"}
              </button>
              <button
                disabled={busy === row.questionnaire_type}
                onClick={() =>
                  void action(row.questionnaire_type, "generate", true)
                }
                className="inline-flex items-center gap-2 rounded-full bg-gold px-4 py-2 text-xs font-black text-navy disabled:opacity-50"
              >
                <Mail className="h-4 w-4" />
                Envoyer
              </button>
              <a
                href={`/admin/clients/${clientId}/questionnaires/${row.questionnaire_type}`}
                className="inline-flex items-center gap-2 rounded-full border border-navy/15 px-4 py-2 text-xs font-black text-navy"
              >
                <Copy className="h-4 w-4" />
                Voir / corriger
              </a>
              <a
                href={`/api/admin/clients/${clientId}/questionnaires/${row.questionnaire_type}/pdf`}
                className="inline-flex items-center gap-2 rounded-full border border-navy/15 px-4 py-2 text-xs font-black text-navy"
              >
                <Download className="h-4 w-4" />
                PDF
              </a>
              <button
                title="Invalide le lien public sans supprimer les réponses."
                disabled={busy === row.questionnaire_type}
                onClick={() => void action(row.questionnaire_type, "disable")}
                className="inline-flex items-center gap-2 rounded-full border border-red-200 px-4 py-2 text-xs font-black text-red-700"
              >
                <Power className="h-4 w-4" />
                Désactiver
              </button>
            </div>
            <p className="mt-3 text-xs text-navy/45">
              Désactiver invalide uniquement le lien public. Les réponses et
              brouillons restent intacts.
            </p>
          </article>
        );
      })}
    </div>
  );
}
