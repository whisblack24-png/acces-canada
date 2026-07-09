"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: formData.get("password") }),
    });

    if (!response.ok) {
      const result = (await response.json()) as { message?: string };
      setError(result.message || "Connexion impossible.");
      setLoading(false);
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-5">
      <label className="block text-sm font-bold text-navy/72">
        Mot de passe administrateur
        <span className="relative mt-2 block">
          <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-navy/30" />
          <input
            name="password"
            type="password"
            required
            className="w-full rounded-2xl border border-navy/10 bg-ivory py-4 pl-12 pr-4 text-navy outline-none transition focus:border-gold"
            placeholder="Entrez le mot de passe"
          />
        </span>
      </label>

      {error ? <p className="rounded-2xl bg-canada/8 px-4 py-3 text-sm font-bold text-canada">{error}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-navy px-6 py-4 text-sm font-black text-white transition hover:bg-canada disabled:cursor-not-allowed disabled:bg-navy/50"
      >
        {loading ? "Connexion..." : "Se connecter"}
      </button>
    </form>
  );
}
