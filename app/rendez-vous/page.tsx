import type { Metadata } from "next";
import { CalendarCheck, Clock, ShieldCheck } from "lucide-react";
import { BookingForm } from "@/components/BookingForm";
import { InteriorHero } from "@/components/InteriorHero";
import { Reveal } from "@/components/Reveal";
import { brand } from "@/lib/site";

export const metadata: Metadata = {
  title: "Prendre rendez-vous",
  description: "Réservez et payez une consultation Accès Canada en ligne.",
};

export default function AppointmentPage() {
  return (
    <main>
      <InteriorHero
        eyebrow="Rendez-vous"
        title="Réservez votre consultation Accès Canada."
        text="Choisissez directement un créneau, confirmez vos informations et payez en ligne pour recevoir votre confirmation et votre facture."
      />

      <section className="bg-ivory px-6 py-20">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
          <Reveal className="rounded-[2rem] bg-navy p-8 text-white shadow-premium md:p-10">
            <p className="text-sm font-black uppercase tracking-[0.24em] text-gold">Consultation payante</p>
            <h2 className="mt-5 font-display text-4xl font-black leading-tight">Un parcours simple, clair et sécurisé.</h2>
            <p className="mt-5 leading-8 text-white/70">
              Choisissez une consultation de 30 ou 60 minutes, sélectionnez une date disponible, puis confirmez le rendez-vous
              avec un paiement sécurisé Stripe.
            </p>
            <p className="mt-4 rounded-2xl border border-gold/25 bg-white/8 p-4 text-sm leading-6 text-white/68">
              Aucun rendez-vous n'est créé si le paiement échoue ou si la transaction est annulée. Après confirmation, vous
              recevez automatiquement le courriel de confirmation et votre facture acquittée.
            </p>

            <div className="mt-8 space-y-4">
              {[
                { icon: CalendarCheck, title: "Réservation confirmée", text: "Le créneau devient indisponible après paiement validé." },
                { icon: Clock, title: "30 ou 60 minutes", text: "Choisissez la durée adaptée à votre besoin." },
                { icon: ShieldCheck, title: "Paiement sécurisé", text: "Les clés Stripe restent protégées côté serveur." },
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
              Vous pouvez aussi nous écrire directement à {brand.email} si aucun créneau ne correspond à votre disponibilité.
            </p>
          </Reveal>

          <Reveal delay={0.08} className="overflow-hidden rounded-[2rem] border border-navy/10 bg-white shadow-premium">
            <BookingForm />
          </Reveal>
        </div>
      </section>
    </main>
  );
}
