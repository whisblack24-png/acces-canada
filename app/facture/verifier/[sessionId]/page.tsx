import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, CalendarCheck, FileCheck2, ShieldCheck } from "lucide-react";
import { getAppointmentByStripeSession } from "@/lib/booking";
import { consultationTypes, formatDateTimeFr } from "@/lib/booking-shared";
import { formatUsd } from "@/lib/format";

export const metadata: Metadata = { title: "Vérification de facture" };
export const dynamic = "force-dynamic";

export default async function VerifyInvoicePage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const appointment = sessionId.startsWith("cs_") ? await getAppointmentByStripeSession(sessionId).catch(() => null) : null;

  return (
    <main className="min-h-screen bg-ivory px-5 py-14 text-navy">
      <section className="mx-auto max-w-3xl overflow-hidden rounded-[2rem] bg-white shadow-premium">
        <div className="bg-navy px-7 py-9 text-white md:px-10">
          <ShieldCheck className="h-12 w-12 text-gold" />
          <p className="mt-5 text-xs font-black uppercase tracking-[0.24em] text-gold">Vérification officielle</p>
          <h1 className="mt-3 font-display text-4xl font-black md:text-5xl">Authenticité de la facture</h1>
        </div>

        {appointment ? (
          <div className="p-7 md:p-10">
            <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 font-black text-emerald-800">
              <BadgeCheck className="h-6 w-6" /> Facture authentique et paiement confirmé
            </div>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <Info icon={<FileCheck2 />} label="Facture" value={appointment.invoice_number} />
              <Info icon={<BadgeCheck />} label="Réservation" value={appointment.booking_reference} />
              <Info icon={<CalendarCheck />} label="Rendez-vous" value={formatDateTimeFr(appointment.starts_at)} />
              <Info icon={<ShieldCheck />} label="Montant" value={formatUsd(appointment.amount_cents / 100)} />
            </div>
            <p className="mt-6 text-sm font-bold text-navy/58">{consultationTypes[appointment.consultation_type].label}</p>
          </div>
        ) : (
          <div className="p-7 md:p-10">
            <p className="rounded-2xl bg-canada/8 p-5 font-bold text-canada">Cette facture n’a pas pu être authentifiée.</p>
          </div>
        )}

        <div className="border-t border-navy/10 px-7 py-6 md:px-10">
          <Link href="/" className="font-black text-canada">Retour à Accès Canada</Link>
        </div>
      </section>
    </main>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-ivory p-5">
      <span className="text-gold">{icon}</span>
      <span className="mt-3 block text-xs font-black uppercase tracking-[0.16em] text-navy/42">{label}</span>
      <span className="mt-1 block font-black text-navy">{value}</span>
    </div>
  );
}
