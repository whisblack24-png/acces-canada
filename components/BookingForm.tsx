"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, CheckCircle2, Clock3, CreditCard, FileText, Loader2, LogIn, Mail, Phone, Sparkles, Video, UsersRound } from "lucide-react";
import { consultationModeLabels, consultationTypes, type ConsultationMode, type ConsultationType } from "@/lib/booking-shared";
import { formatUsd } from "@/lib/format";

type Slot = { value: string; label: string };
type Confirmation = {
  status: "checking" | "pending" | "confirmed" | "error";
  bookingReference?: string;
  invoiceNumber?: string;
  startsAt?: string;
  consultationLabel?: string;
  consultationMode?: string;
  durationMinutes?: number;
  amountCents?: number;
  currency?: string;
  email?: string;
};

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
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  const selectedType = consultationTypes[consultationType];
  const selectedSlotLabel = slots.find((slot) => slot.value === selectedSlot)?.label || "Aucun créneau sélectionné";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("paiement") === "confirme") {
      const sessionId = params.get("session_id") || "";
      setMessage("Paiement confirmé. Vérification de votre rendez-vous en cours…");
      setInvoiceSessionId(sessionId);
      setConfirmation({ status: sessionId ? "checking" : "error" });
    }
    if (params.get("paiement") === "annule") {
      setMessage("Paiement annulé. Aucun rendez-vous n'a été créé.");
    }
  }, []);

  useEffect(() => {
    if (!invoiceSessionId) return;
    let active = true;
    let attempt = 0;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    async function checkStatus() {
      attempt += 1;
      try {
        const response = await fetch(`/api/booking/status/${encodeURIComponent(invoiceSessionId)}`, { cache: "no-store" });
        const result = (await response.json()) as Confirmation & { message?: string };
        if (!active) return;

        if (response.ok && result.status === "confirmed") {
          setConfirmation(result);
          setMessage("Votre rendez-vous et votre facture ont été créés. Le courriel de confirmation est envoyé à l'adresse fournie.");
          return;
        }
        if (!response.ok && result.status !== "pending") {
          setConfirmation({ status: "error" });
          setMessage(result.message || "Le paiement est confirmé, mais le rendez-vous ne peut pas encore être vérifié.");
          return;
        }
        setConfirmation({ status: "pending" });
        if (attempt >= 15) setMessage("Paiement confirmé. La préparation de votre rendez-vous prend un peu plus de temps. Cette page se met à jour automatiquement.");
        timeout = setTimeout(checkStatus, attempt < 15 ? 2_000 : 5_000);
      } catch {
        if (active) {
          setConfirmation({ status: "pending" });
          setMessage("Paiement confirmé. Nous attendons la finalisation sécurisée de votre réservation.");
          timeout = setTimeout(checkStatus, 5_000);
        }
      }
    }

    checkStatus();
    return () => {
      active = false;
      if (timeout) clearTimeout(timeout);
    };
  }, [invoiceSessionId]);

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

      {confirmation ? (
        <section className="m-5 border-2 border-gold bg-[#FBF7EA] p-6 text-center md:m-7 md:p-10" aria-live="polite">
          <div className="relative mx-auto grid h-20 w-20 place-items-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-gold/25" />
            <span className="relative grid h-16 w-16 place-items-center rounded-full bg-navy text-gold shadow-premium">
              <CheckCircle2 className="h-9 w-9" />
            </span>
            <Sparkles className="absolute -right-1 top-0 h-5 w-5 animate-pulse text-canada" />
          </div>
          <p className="mt-5 text-xs font-black uppercase tracking-[0.24em] text-canada">Transaction Stripe acceptée</p>
          <h3 className="mt-3 font-display text-4xl font-black text-navy">Paiement confirmé</h3>
          <p className="mx-auto mt-4 max-w-2xl text-sm font-bold leading-7 text-navy/70">{message}</p>

          {confirmation.status === "confirmed" ? (
            <>
              <div className="mx-auto mt-6 grid max-w-2xl gap-3 text-left sm:grid-cols-2">
                <p className="flex items-center gap-3 bg-emerald-50 p-4 font-black text-emerald-800"><CheckCircle2 className="h-5 w-5" /> Paiement confirmé</p>
                <p className="flex items-center gap-3 bg-emerald-50 p-4 font-black text-emerald-800"><CheckCircle2 className="h-5 w-5" /> Rendez-vous confirmé</p>
              </div>
              <div className="mx-auto mt-3 grid max-w-2xl gap-3 bg-white p-5 text-left text-sm font-bold text-navy/70 sm:grid-cols-2">
                <Summary icon={<FileText />} label="Réservation" value={confirmation.bookingReference || "-"} />
                <Summary icon={<FileText />} label="Facture" value={confirmation.invoiceNumber || "-"} />
                <Summary icon={<Clock3 />} label="Type de consultation" value={confirmation.consultationLabel || "Consultation"} />
                {confirmation.startsAt ? <Summary icon={<CalendarDays />} label="Date" value={new Date(confirmation.startsAt).toLocaleDateString("fr-CA", { dateStyle: "long", timeZone: "America/Toronto" })} /> : null}
                {confirmation.startsAt ? <Summary icon={<Clock3 />} label="Heure" value={new Date(confirmation.startsAt).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit", timeZone: "America/Toronto" })} /> : null}
                <Summary icon={<Clock3 />} label="Durée" value={`${confirmation.durationMinutes || 0} minutes`} />
                <Summary icon={<Video />} label="Mode" value={confirmation.consultationMode || "Non renseigné"} />
                <Summary icon={<CreditCard />} label="Montant payé" value={formatUsd((confirmation.amountCents || 0) / 100)} />
                <Summary icon={<Mail />} label="Courriel utilisé" value={confirmation.email || "Non renseigné"} />
              </div>
              <p className="mx-auto mt-5 max-w-2xl text-sm font-bold leading-7 text-navy/70">
                Votre paiement et votre réservation ont été enregistrés avec succès. Un courriel contenant votre confirmation, votre facture et les informations nécessaires pour accéder à votre espace client vous a été envoyé. Vous pouvez rester sur cette page ou retourner à l’accueil lorsque vous le souhaitez.
              </p>
              <p className="mt-3 text-xs font-black uppercase tracking-[0.12em] text-navy/50">
                Le code d’accès au portail client expire après 10 minutes.
              </p>
            </>
          ) : (
            <p className="mt-6 font-black text-navy">Finalisation du rendez-vous en cours…</p>
          )}

          <div className="mt-7 flex flex-wrap justify-center gap-3">
            {confirmation.status === "confirmed" ? (
              <Link href="/" className="bg-canada px-6 py-3 text-sm font-black text-white">Retourner à l’accueil</Link>
            ) : null}
            {confirmation.status === "confirmed" ? (
              <a href={`/api/booking/invoice/session/${invoiceSessionId}`} className="bg-white px-6 py-3 text-sm font-black text-canada ring-1 ring-canada/20">
                Télécharger ma facture
              </a>
            ) : null}
            <Link href="/client/login" className="inline-flex items-center gap-2 bg-gold px-6 py-3 text-sm font-black text-navy">
              <LogIn className="h-4 w-4" /> Accéder à mon espace client
            </Link>
          </div>
        </section>
      ) : null}

      <div className={`grid gap-6 p-5 md:p-7 ${confirmation ? "border-t border-navy/10 opacity-60" : ""}`}>
        {message ? (
          <div role="status" aria-live="polite" className="flex items-start gap-3 border border-gold/35 bg-[#FBF7EA] p-4 text-sm font-bold leading-6 text-navy">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-canada" />
            <span>{message}</span>
            {invoiceSessionId && confirmation?.status === "confirmed" ? (
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
                  <span className="mt-3 block text-lg font-black text-canada">{formatUsd(item.amountCents / 100)}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <label htmlFor="booking-slot" className="text-sm font-black text-navy">Date et heure disponibles</label>
          <select
            id="booking-slot"
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
            <p className="text-lg font-black text-canada">{formatUsd(selectedType.amountCents / 100)}</p>
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

function Summary({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-ivory p-3">
      <span className="mt-0.5 text-gold [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      <span><span className="block text-[10px] uppercase tracking-[0.14em] text-navy/42">{label}</span><span className="mt-1 block text-navy">{value}</span></span>
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
