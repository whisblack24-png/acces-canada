"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail, ShieldCheck } from "lucide-react";

export function ClientLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setFeedback("");
    const response = await fetch("/api/client/auth/request-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const result = (await response.json().catch(() => ({}))) as { message?: string };
    setLoading(false);
    setFeedback(result.message || "");
    if (response.ok) setStep("code");
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setFeedback("");
    const response = await fetch("/api/client/auth/verify-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, code }),
    });
    const result = (await response.json().catch(() => ({}))) as { message?: string };
    setLoading(false);
    if (!response.ok) {
      setFeedback(result.message || "Connexion impossible.");
      return;
    }
    router.push("/client/dashboard");
    router.refresh();
  }

  return (
    <div className="min-w-0 w-full max-w-xl overflow-hidden rounded-[2rem] bg-white p-5 shadow-premium sm:p-6 md:p-8">
      <div className="mb-7 flex items-center justify-between gap-4">
        <Image src="/images/logo.png" alt="Accès Canada" width={58} height={58} className="h-14 w-14 rounded-2xl" />
        <Link
          href="/"
          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-navy/10 px-3 py-2 text-xs font-black text-navy/70 transition hover:border-gold hover:text-navy sm:px-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Site officiel
        </Link>
      </div>
      <p className="text-xs font-black uppercase tracking-[0.22em] text-canada">Portail client</p>
      <h1 className="mt-3 break-words font-display text-3xl font-black text-navy sm:text-4xl">Connexion sécurisée</h1>
      <p className="mt-4 leading-7 text-navy/60">
        Entrez le courriel associé à votre dossier. Un code temporaire vous sera envoyé pour protéger votre accès.
      </p>

      {step === "email" ? (
        <form onSubmit={requestCode} className="mt-6 space-y-4">
          <label className="block text-sm font-bold text-navy/70">
            Courriel
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-navy/10 bg-ivory px-4 py-3 text-navy outline-none focus:border-gold"
            />
          </label>
          {feedback ? <p className="rounded-2xl bg-gold/15 px-4 py-3 text-sm font-bold text-navy">{feedback}</p> : null}
          <button type="submit" disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-canada px-5 py-3 text-sm font-black text-white transition hover:bg-navy disabled:bg-navy/40">
            <Mail className="h-4 w-4" />
            {loading ? "Envoi..." : "Recevoir le code"}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="mt-6 space-y-4">
          <label className="block text-sm font-bold text-navy/70">
            Code reçu par courriel
            <input
              inputMode="numeric"
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-navy/10 bg-ivory px-4 py-3 text-navy outline-none focus:border-gold"
            />
          </label>
          {feedback ? <p className="rounded-2xl bg-gold/15 px-4 py-3 text-sm font-bold text-navy">{feedback}</p> : null}
          <button type="submit" disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-canada px-5 py-3 text-sm font-black text-white transition hover:bg-navy disabled:bg-navy/40">
            <ShieldCheck className="h-4 w-4" />
            {loading ? "Vérification..." : "Accéder au portail"}
          </button>
        </form>
      )}
    </div>
  );
}
