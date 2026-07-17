"use client";

import { useMemo, useState } from "react";
import { CalendarClock, CalendarX2, CreditCard, Download, Mail, ReceiptText, Search } from "lucide-react";
import {
  consultationModeLabels,
  consultationTypes,
  formatDateTimeFr,
  type Appointment,
  type AppointmentStatus,
} from "@/lib/booking-shared";
import { formatMoney } from "@/lib/format";

const statusLabels: Record<AppointmentStatus, string> = {
  confirmed: "Confirmé",
  cancelled: "Annulé",
};

export function AppointmentsManager({ initialAppointments }: { initialAppointments: Appointment[] }) {
  const [appointments, setAppointments] = useState(initialAppointments);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [date, setDate] = useState("");
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return appointments.filter((appointment) => {
      const matchesStatus = status ? appointment.status === status : true;
      const matchesDate = date ? appointment.starts_at.slice(0, 10) === date : true;
      const matchesSearch = term
        ? [
            appointment.client_full_name,
            appointment.client_email,
            appointment.client_phone,
            appointment.booking_reference,
            appointment.invoice_number,
          ]
            .join(" ")
            .toLowerCase()
            .includes(term)
        : true;
      return matchesStatus && matchesDate && matchesSearch;
    });
  }, [appointments, search, status, date]);

  const stats = useMemo(() => {
    const confirmed = appointments.filter((appointment) => appointment.status === "confirmed");
    const now = Date.now();
    return {
      active: confirmed.length,
      upcoming: confirmed.filter((appointment) => Date.parse(appointment.starts_at) >= now).length,
      cancelled: appointments.filter((appointment) => appointment.status === "cancelled").length,
      revenue: confirmed.reduce((total, appointment) => total + appointment.amount_cents / 100, 0),
    };
  }, [appointments]);

  const calendarDays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(today);
      day.setDate(today.getDate() + index);
      const key = day.toISOString().slice(0, 10);
      return {
        key,
        label: day.toLocaleDateString("fr-CA", { weekday: "short", day: "numeric", month: "short" }),
        appointments: appointments.filter((item) => item.status === "confirmed" && item.starts_at.slice(0, 10) === key),
      };
    });
  }, [appointments]);

  async function action(id: string, body: Record<string, string>) {
    setBusyId(id);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.message || "Action impossible.");
        return;
      }
      if (data.appointment) {
        setAppointments((items) => items.map((item) => (item.id === id ? data.appointment : item)));
      }
      setMessage(body.action === "resend" ? "Courriel de confirmation renvoyé." : body.action === "cancel" ? "Le rendez-vous a été annulé et retiré des statistiques actives." : "Rendez-vous mis à jour.");
    } catch {
      setMessage("La mise à jour du rendez-vous a échoué. Veuillez réessayer.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="space-y-5">
      {message ? <p className="border border-gold/40 bg-[#FBF7EA] p-4 text-sm font-bold text-navy">{message}</p> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-live="polite">
        <Stat label="Rendez-vous actifs" value={String(stats.active)} icon={<CalendarClock className="h-5 w-5" />} />
        <Stat label="À venir" value={String(stats.upcoming)} icon={<CreditCard className="h-5 w-5" />} />
        <Stat label="Annulés" value={String(stats.cancelled)} icon={<CalendarX2 className="h-5 w-5" />} />
        <Stat label="Revenus actifs" value={`${formatMoney(stats.revenue)} USD`} icon={<ReceiptText className="h-5 w-5" />} />
      </section>

      <section className="rounded-[2rem] bg-white p-5 shadow-premium md:p-7">
        <div className="flex items-center justify-between gap-4">
          <div><p className="text-xs font-black uppercase tracking-[0.18em] text-canada">Calendrier</p><h2 className="mt-2 font-display text-2xl font-black text-navy">Les 7 prochains jours</h2></div>
          <CalendarClock className="h-6 w-6 text-gold" />
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-4 xl:grid-cols-7">
          {calendarDays.map((day) => (
            <button key={day.key} type="button" onClick={() => setDate(day.key)} className="min-h-32 rounded-2xl border border-navy/10 bg-ivory p-3 text-left transition hover:border-gold">
              <span className="block text-xs font-black uppercase text-navy/45">{day.label}</span>
              <span className="mt-3 block text-2xl font-black text-navy">{day.appointments.length}</span>
              <span className="text-xs font-bold text-navy/45">rendez-vous</span>
              {day.appointments.slice(0, 2).map((item) => <span key={item.id} className="mt-2 block truncate text-[10px] font-black text-canada">{new Date(item.starts_at).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit", timeZone: "America/Toronto" })} · {item.client_first_name}</span>)}
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-3 bg-white p-5 shadow-premium md:grid-cols-[1fr_180px_180px]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy/35" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher un client, une réservation ou une facture"
            className="w-full border border-navy/10 py-3 pl-10 pr-4 text-sm font-bold text-navy outline-none focus:border-gold"
          />
        </label>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="border border-navy/10 px-4 py-3 text-sm font-bold text-navy outline-none focus:border-gold"
        >
          <option value="">Tous les statuts</option>
          <option value="confirmed">Confirmés</option>
          <option value="cancelled">Annulés</option>
        </select>
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="border border-navy/10 px-4 py-3 text-sm font-bold text-navy outline-none focus:border-gold"
        />
      </div>

      <div className="overflow-hidden bg-white shadow-premium">
        <div className="hidden grid-cols-[0.9fr_0.9fr_0.8fr_0.7fr_0.7fr_0.8fr] bg-navy px-5 py-3 text-xs font-black uppercase tracking-[0.14em] text-white/70 xl:grid">
          <span>Client</span>
          <span>Rendez-vous</span>
          <span>Paiement</span>
          <span>Réservation</span>
          <span>Facture</span>
          <span>Actions</span>
        </div>
        {filtered.length ? (
          filtered.map((appointment) => (
            <div key={appointment.id} className="grid gap-4 border-t border-navy/10 px-5 py-5 text-sm font-bold text-navy/70 xl:grid-cols-[0.9fr_0.9fr_0.8fr_0.7fr_0.7fr_0.8fr]">
              <span>
                <span className="block font-black text-navy">{appointment.client_full_name}</span>
                <span className="mt-1 block text-xs text-navy/45">{appointment.client_email}</span>
                <span className="mt-1 block text-xs text-navy/45">{appointment.client_phone}</span>
              </span>
              <span>
                <span className="block font-black text-navy">{formatDateTimeFr(appointment.starts_at)}</span>
                <span className="mt-1 block text-xs text-navy/45">
                  {consultationTypes[appointment.consultation_type].label} · {consultationModeLabels[appointment.consultation_mode]}
                </span>
                <span className="mt-1 block text-xs font-black text-canada">{statusLabels[appointment.status]}</span>
              </span>
              <span>
                <span className="block font-black text-navy">{formatMoney(appointment.amount_cents / 100)} USD</span>
                <span className="mt-1 block text-xs text-navy/45">{appointment.stripe_payment_intent || appointment.stripe_session_id}</span>
              </span>
              <span>{appointment.booking_reference}</span>
              <a href={`/api/booking/invoice/${appointment.id}`} className="inline-flex items-center gap-2 font-black text-canada">
                <Download className="h-4 w-4" />
                {appointment.invoice_number}
              </a>
              <span className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busyId === appointment.id}
                  onClick={() => action(appointment.id, { action: "resend" })}
                  className="grid h-10 w-10 place-items-center bg-gold text-navy disabled:opacity-40"
                  title="Renvoyer le courriel"
                >
                  <Mail className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={busyId === appointment.id}
                  onClick={() => {
                    const value = window.prompt("Nouvelle date et heure au format AAAA-MM-JJTHH:MM", appointment.starts_at.slice(0, 16));
                    if (value) action(appointment.id, { action: "move", startsAt: value });
                  }}
                  className="grid h-10 w-10 place-items-center bg-navy text-white disabled:opacity-40"
                  title="Déplacer"
                >
                  <CalendarClock className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={busyId === appointment.id || appointment.status === "cancelled"}
                  onClick={() => {
                    if (window.confirm(`Annuler le rendez-vous ${appointment.booking_reference} ? La facture et l’historique seront conservés.`)) {
                      void action(appointment.id, { action: "cancel" });
                    }
                  }}
                  className="inline-flex min-h-10 items-center gap-2 bg-canada px-3 text-xs font-black text-white disabled:opacity-40"
                  title="Annuler le rendez-vous"
                >
                  <CalendarX2 className="h-4 w-4" />
                  {busyId === appointment.id ? "Annulation…" : appointment.status === "cancelled" ? "Annulé" : "Annuler le rendez-vous"}
                </button>
              </span>
            </div>
          ))
        ) : (
          <p className="p-5 text-sm font-bold text-navy/50">Aucun rendez-vous ne correspond aux filtres.</p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white p-5 shadow-premium">
      <span className="grid h-11 w-11 place-items-center bg-gold/20 text-navy">{icon}</span>
      <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-navy/42">{label}</p>
      <p className="mt-2 text-3xl font-black text-navy">{value}</p>
    </div>
  );
}
