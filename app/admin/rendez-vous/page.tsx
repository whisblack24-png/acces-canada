import type { Metadata } from "next";
import type React from "react";
import { redirect } from "next/navigation";
import { CalendarCheck, CreditCard, FileText, ReceiptText } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { AppointmentsManager } from "@/components/admin/AppointmentsManager";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { listAppointments } from "@/lib/booking";
import { formatMoney } from "@/lib/format";

export const metadata: Metadata = {
  title: "Rendez-vous et paiements",
};

export default async function AdminAppointmentsPage() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  const appointments = await listAppointments().catch(() => []);
  const confirmed = appointments.filter((appointment) => appointment.status === "confirmed");
  const cancelled = appointments.filter((appointment) => appointment.status === "cancelled");
  const revenue = confirmed.reduce((total, appointment) => total + appointment.amount_cents / 100, 0);

  return (
    <AdminShell>
      <div className="space-y-7">
        <section className="bg-navy px-6 py-7 text-white shadow-premium md:px-8">
          <p className="text-sm font-black uppercase tracking-[0.24em] text-gold">Réservations</p>
          <h1 className="mt-3 font-display text-4xl font-black md:text-5xl">Rendez-vous, paiements et factures</h1>
          <p className="mt-4 max-w-3xl leading-8 text-white/66">
            Consultez les consultations payées, les numéros de réservation, les factures et les actions de suivi.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Stat label="Rendez-vous" value={String(appointments.length)} icon={<CalendarCheck className="h-5 w-5" />} />
          <Stat label="Confirmés" value={String(confirmed.length)} icon={<CreditCard className="h-5 w-5" />} />
          <Stat label="Annulés" value={String(cancelled.length)} icon={<FileText className="h-5 w-5" />} />
          <Stat label="Revenus consultations" value={`${formatMoney(revenue)} USD`} icon={<ReceiptText className="h-5 w-5" />} />
        </section>

        <AppointmentsManager initialAppointments={appointments} />
      </div>
    </AdminShell>
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
