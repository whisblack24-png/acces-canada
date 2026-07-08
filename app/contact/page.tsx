import type { Metadata } from "next";
import { ContactForm } from "@/components/ContactForm";
import { InteriorHero } from "@/components/InteriorHero";
import { Reveal } from "@/components/Reveal";
import { brand, contactMethods } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contactez Accès Canada par téléphone, email ou formulaire pour démarrer votre projet canadien."
};

export default function ContactPage() {
  return (
    <main>
      <InteriorHero
        eyebrow="Contact"
        title="Démarrez votre projet avec Accès Canada."
        text="Un premier message suffit pour poser les bases de votre parcours et recevoir une orientation adaptée."
      />
      <section className="bg-white px-6 py-20">
        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-3">
          {contactMethods.map((method, index) => (
            <Reveal key={method.label} delay={index * 0.06} className="rounded-[1.5rem] bg-ivory p-7 shadow-premium">
              <method.icon className="h-8 w-8 text-gold" />
              <p className="mt-5 text-sm font-black uppercase tracking-[0.2em] text-canada">{method.label}</p>
              <a href={method.href} className="mt-3 block text-xl font-black text-navy">
                {method.value}
              </a>
            </Reveal>
          ))}
        </div>
      </section>
      <ContactForm />
      <section className="bg-navy px-6 py-20 text-white">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-white/10 bg-white/8 p-8 md:p-10">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-gold">Google Maps</p>
          <h2 className="mt-4 font-display text-4xl font-black">Accès Canada</h2>
          <p className="mt-4 max-w-2xl leading-8 text-white/68">
            Consultations offertes au Canada et à distance. Pour planifier un échange, contactez-nous au {brand.phone}
            ou par email à {brand.email}.
          </p>
        </div>
      </section>
    </main>
  );
}
