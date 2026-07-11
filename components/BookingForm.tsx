"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CreditCard, Loader2, Phone, Video, UsersRound } from "lucide-react";
import { consultationModeLabels, consultationTypes, type ConsultationMode, type ConsultationType } from "@/lib/booking-shared";
import { formatMoney } from "@/lib/format";

type Slot = { value: string; label: string };

const modes: { value: ConsultationMode; icon: typeof Phone }[] = [
  { value: "telephone", icon: Phone },
  { value: "visioconference", icon: Video },
  { value: "en_personne", icon: UsersRound },
];

const initialForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  country: "",
  reason: "",
  consultationMode: "visioconference" as ConsultationMode,
};

export function BookingForm() {
  const [consultationType, setConsultationType] = useState<ConsultationType>("consultation_30");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [form, setForm] = useState(initialForm);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [invoiceSessionId, setInvoiceSessionId] = useState("");

  const selectedType = consultationTypes[consultationType];
  const selectedSlotLabel = slots.find((slot) => slot.value === selectedSlot)?.label || "Aucun créneau sélectionné";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("paiement") === "confirme") {
      setMessage("Paiement confirmé. Votre rendez-vous est en cours de finalisation et vous recevrez votre courriel de confirmation.");
      setInvoiceSessionId(params.get("session_id") || "");
    }
    if (params.get("paiement") === "annule") {
      setMessage("Paiement annulé. Aucun rendez-vous n'a été créé.");
    }
  }, []);

  useEffect(() => {
    let active = true;
    setLoadingSlots(true);
    setSelectedSlot("");
    fetch(`/api/booking/slots?type=${consultationType}`)
      .then((response) => response.json())
      .then((data) => {
        if (active) setSlots(Array.isArray(data.slots) ? data.slots : []);
      })
      .catch(() => {
        if (active) setMessage("Impossible de charger les créneaux disponibles pour le moment.");
      })
      .finally(() => {
        if (active) setLoadingSlots(false);
      });

    return () => {
      active = false;
    };
  }, [consultationType]);

  const canSubmit = useMemo(
    () =>
      Boolean(
        consultationType &&
          selectedSlot &&
          form.firstName.trim() &&
          form.lastName.trim() &&
          form.email.trim() &&
          form.phone.trim() &&
          form.country.trim() &&
          form.reason.trim(),
      ),
    [consultationType, selectedSlot, form],
  );

  async function submit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setMessage("");

    const response = await fetch("/api/booking/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        consultationType,
        startsAt: selectedSlot,
        ...form,
      }),
    });
    const data = await response.json();
    if (!response.ok || !data.checkoutUrl) {
      setMessage(data.message || "Le paiement sécurisé n'a pas pu être préparé.");
      setSubmitting(false);
      return;
    }

    window.location.href = data.checkoutUrl;
  }

  return (
    <div className="bg-white">
      <div className="border-b border-navy/10 px-5 py-5 md:px-7">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-canada">Réservation avec paiement sécurisé</p>
        <h2 className="mt-2 font-display text-3xl font-black text-navy">Prendre rendez-vous</h2>
        <p className="mt-2 text-sm leading-6 text-navy/58">
          Le rendez-vous est confirmé uniquement après validation du paiement par Stripe.
        </p>
      </div>

      <div className="grid gap-6 p-5 md:p-7">
        {message ? (
          <div className="flex items-start gap-3 border border-gold/35 bg-[#FBF7EA] p-4 text-sm font-bold leading-6 text-navy">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-canada" />
            <span>{message}</span>
            {invoiceSessionId ? (
              <a href={`/api/booking/invoice/session/${invoiceSessionId}`} className="ml-auto shrink-0 font-black text-canada underline">
                Télécharger la facture
              </a>
            ) : null}
          </div>
        ) : null}

        <section>
          <p className="text-sm font-black text-navy">Type de consultation</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {(Object.keys(consultationTypes) as ConsultationType[]).map((type) => {
              const item = consultationTypes[type];
              const active = consultationType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setConsultationType(type)}
                  className={`border p-4 text-left transition ${
                    active ? "border-gold bg-gold/12 text-navy" : "border-navy/10 bg-ivory text-navy/72 hover:border-gold/50"
                  }`}
                >
                  <span className="block font-black">{item.label}</span>
                  <span className="mt-2 block text-sm leading-6">{item.description}</span>
                  <span className="mt-3 block text-lg font-black text-canada">{formatMoney(item.amountCents / 100)} USD</span>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <p className="text-sm font-black text-navy">Date et heure disponibles</p>
          <select
            value={selectedSlot}
            onChange={(event) => setSelectedSlot(event.target.value)}
            className="mt-3 w-full border border-navy/15 bg-white px-4 py-3 text-sm font-bold text-navy outline-none focus:border-gold"
          >
            <option value="">{loadingSlots ? "Chargement des créneaux..." : "Choisir un créneau"}</option>
            {slots.map((slot) => (
              <option key={slot.value} value={slot.value}>
                {slot.label}
              </option>
            ))}
          </select>
          {!loadingSlots && !slots.length ? <p className="mt-2 text-sm font-bold text-canada">Aucun créneau disponible pour le moment.</p> : null}
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <Field label="Prénom" value={form.firstName} onChange={(value) => setForm({ ...form, firstName: value })} />
          <Field label="Nom" value={form.lastName} onChange={(value) => setForm({ ...form, lastName: value })} />
          <Field label="Adresse courriel" type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} />
          <Field label="Numéro de téléphone" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} />
          <Field label="Pays" value={form.country} onChange={(value) => setForm({ ...form, country: value })} />
          <div>
            <label className="text-sm font-black text-navy">Mode de consultation</label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {modes.map((mode) => {
                const active = form.consultationMode === mode.value;
                return (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => setForm({ ...form, consultationMode: mode.value })}
                    className={`grid min-h-20 place-items-center border px-2 py-3 text-center text-xs font-black transition ${
                      active ? "border-gold bg-gold/15 text-navy" : "border-navy/10 bg-ivory text-navy/62"
                    }`}
                    title={consultationModeLabels[mode.value]}
                  >
                    <mode.icon className="h-5 w-5" />
                    <span className="mt-2">{consultationModeLabels[mode.value]}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <label className="md:col-span-2">
            <span className="text-sm font-black text-navy">Motif de la consultation</span>
            <textarea
              value={form.reason}
              onChange={(event) => setForm({ ...form, reason: event.target.value })}
              rows={4}
              className="mt-2 w-full border border-navy/15 bg-white px-4 py-3 text-sm font-bold text-navy outline-none focus:border-gold"
            />
          </label>
        </section>

        <section className="border border-navy/10 bg-ivory p-5">
          <p className="font-display text-2xl font-black text-navy">Résumé</p>
          <div className="mt-4 grid gap-2 text-sm font-bold text-navy/70">
            <p>{selectedType.label}</p>
            <p>{selectedSlotLabel}</p>
            <p>{consultationModeLabels[form.consultationMode]}</p>
            <p className="text-lg font-black text-canada">{formatMoney(selectedType.amountCents / 100)} USD</p>
          </div>
        </section>

        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit || submitting}
          className="inline-flex items-center justify-center gap-2 bg-canada px-6 py-4 text-sm font-black text-white transition hover:bg-navy disabled:cursor-not-allowed disabled:bg-navy/25"
        >
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <CreditCard className="h-5 w-5" />}
          Payer et confirmer le rendez-vous
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label>
      <span className="text-sm font-black text-navy">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full border border-navy/15 bg-white px-4 py-3 text-sm font-bold text-navy outline-none focus:border-gold"
      />
    </label>
  );
}
