"use client";

import { FormEvent, useState } from "react";
import { Send } from "lucide-react";
import type { ClientMessage } from "@/lib/client-portal";

export function SecureMessages({ initialMessages, adminClientId }: { initialMessages: ClientMessage[]; adminClientId?: string }) {
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState("");
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const endpoint = adminClientId ? `/api/admin/clients/${adminClientId}/messages` : "/api/client/messages";

  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setFeedback("");
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) });
    const result = (await response.json().catch(() => ({}))) as { message?: ClientMessage | string };
    setLoading(false);
    if (!response.ok || !result.message || typeof result.message === "string") { setFeedback(typeof result.message === "string" ? result.message : "Envoi impossible."); return; }
    setMessages((current) => [...current, result.message as ClientMessage]); setBody(""); setFeedback("Message envoyé.");
  }

  return <div className="space-y-5">
    <div className="max-h-[28rem] space-y-3 overflow-y-auto rounded-2xl bg-ivory p-4">
      {messages.length ? messages.map((message) => <div key={message.id} className={`flex ${message.sender === "client" ? "justify-start" : "justify-end"}`}>
        <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${message.sender === "client" ? "bg-white text-navy" : "bg-navy text-white"}`}>
          <p className="whitespace-pre-wrap text-sm font-bold leading-6">{message.body}</p>
          <p className={`mt-2 text-[10px] font-black uppercase tracking-wider ${message.sender === "client" ? "text-navy/40" : "text-gold"}`}>{message.sender === "client" ? "Client" : "Accès Canada"} · {new Date(message.created_at).toLocaleString("fr-CA")}</p>
        </div>
      </div>) : <p className="py-8 text-center text-sm font-bold text-navy/45">Aucun message pour le moment.</p>}
    </div>
    <form onSubmit={submit} className="space-y-3">
      <label htmlFor="secure-message" className="block text-sm font-black text-navy">Nouveau message sécurisé</label>
      <textarea id="secure-message" value={body} onChange={(event) => setBody(event.target.value)} maxLength={4000} required rows={4} placeholder="Écrivez votre message sécurisé…" className="w-full rounded-2xl border border-navy/10 bg-white px-4 py-3 text-navy outline-none focus:border-gold" />
      {feedback ? <p role="status" aria-live="polite" className="text-sm font-bold text-navy/60">{feedback}</p> : null}
      <button disabled={loading} className="inline-flex items-center gap-2 rounded-full bg-gold px-5 py-3 text-sm font-black text-navy disabled:opacity-50"><Send className="h-4 w-4" />{loading ? "Envoi…" : "Envoyer"}</button>
    </form>
  </div>;
}
