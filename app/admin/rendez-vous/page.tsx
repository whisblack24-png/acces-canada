import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { AppointmentsManager } from "@/components/admin/AppointmentsManager";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { listAppointments } from "@/lib/booking";

export const metadata: Metadata = {
  title: "Rendez-vous et paiements",
};

export default async function AdminAppointmentsPage() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  const appointments = await listAppointments().catch(() => []);

  return (
    <AdminShell>
      <div className="space-y-7">
        <section className="bg-navy px-6 py-7 text-white shadow-premium md:px-8">
          <p className="text-sm font-black uppercase tracking-[0.24em] text-gold">Réservations</p>
          <h1 className="mt-3 font-display text-4xl font-black md:text-5xl">Rendez-vous, paiements et factures</h1>
          <p className="mt-4 max-w-3xl leading-8 text-white/66">
            Consultez les consultations payées, les numéros de réservation, les factures et les actions de suivi.
          </p>
          <Link href="/admin/rendez-vous/automatisations" className="mt-5 inline-flex rounded-full bg-gold px-5 py-3 text-sm font-black text-navy">Configurer les acomptes et rappels</Link>
        </section>

        <AppointmentsManager initialAppointments={appointments} />
      </div>
    </AdminShell>
  );
}
