import type { Metadata } from "next";
import { CalendarCheck, Clock, ShieldCheck } from "lucide-react";
import { CalendlyBooking } from "@/components/CalendlyBooking";
import { InteriorHero } from "@/components/InteriorHero";
import { Reveal } from "@/components/Reveal";
import { brand } from "@/lib/site";

export const metadata: Metadata = {
  title: "Prendre rendez-vous",
  description: "Réservez une consultation en ligne avec Accès Canada via Calendly.",
};

export default function AppointmentPage() {
  return (
    <main>
      <InteriorHero
        eyebrow="Rendez-vous"
        title="Réservez votre consultation Accès Canada."
        text="Choisissez directement un créneau en ligne pour discuter de votre projet, clarifier vos options et préparer la prochaine étape avec notre équipe."
      />

      <section className="bg-ivory px-6 py-20">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
          <Reveal className="rounded-[2rem] bg-navy p-8 text-white shadow-premium md:p-10">
            <p className="text-sm font-black uppercase tracking-[0.24em] text-gold">Consultation en ligne</p>
            <h2 className="mt-5 font-display text-4xl font-black leading-tight">Un créneau adapté à votre disponibilité.</h2>
            <p className="mt-5 leading-8 text-white/70">
              Le calendrier ci-contre vous permet de réserver une consultation de 30 minutes avec Accès Canada. Après la
              réservation, vous recevrez automatiquement les informations du rendez-vous.
            </p>
            <p className="mt-4 rounded-2xl border border-gold/25 bg-white/8 p-4 text-sm leading-6 text-white/68">
              Toute l'expérience que nous contrôlons est présentée en français. Si Calendly affiche une étape système
              dans une autre langue, le message de confirmation Accès Canada s'affichera ici en français après la
              réservation.
            </p>

            <div className="mt-8 space-y-4">
              {[
                { icon: CalendarCheck, title: "Réservation simple", text: "Sélectionnez le jour et l'heure qui vous conviennent." },
                { icon: Clock, title: "Consultation de 30 minutes", text: "Un échange ciblé pour comprendre votre situation." },
                { icon: ShieldCheck, title: "Accompagnement professionnel", text: "Une première orientation claire et confidentielle." },
              ].map((item) => (
                <div key={item.title} className="flex gap-4 rounded-2xl bg-white/8 p-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gold text-navy">
                    <item.icon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block font-black">{item.title}</span>
                    <span className="mt-1 block text-sm leading-6 text-white/62">{item.text}</span>
                  </span>
                </div>
              ))}
            </div>

            <p className="mt-8 text-sm leading-6 text-white/56">
              Vous pouvez aussi nous écrire directement à {brand.email} si aucun créneau ne correspond à votre
              disponibilité.
            </p>
          </Reveal>

          <Reveal delay={0.08} className="overflow-hidden rounded-[2rem] border border-navy/10 bg-white shadow-premium">
            <CalendlyBooking />
          </Reveal>
        </div>
      </section>
    </main>
  );
}
