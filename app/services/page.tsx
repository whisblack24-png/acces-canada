import type { Metadata } from "next";
import { ContactForm } from "@/components/ContactForm";
import { InteriorHero } from "@/components/InteriorHero";
import { Reveal } from "@/components/Reveal";
import { services } from "@/lib/site";

export const metadata: Metadata = {
  title: "Services",
  description: "Services Accès Canada: études, travail, immigration, installation, regroupement familial et conseil personnalisé."
};

export default function ServicesPage() {
  return (
    <main>
      <InteriorHero
        eyebrow="Services"
        title="Des services complets pour préparer votre parcours canadien."
        text="Choisissez un accompagnement clair, structuré et adapté à votre situation personnelle, académique ou professionnelle."
      />
      <section className="bg-ivory px-6 py-24">
        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-2 xl:grid-cols-3">
          {services.map((service, index) => (
            <Reveal key={service.title} delay={index * 0.05} className="rounded-[2rem] bg-white p-8 shadow-premium">
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gold/15 text-gold">
                <service.icon className="h-8 w-8" />
              </div>
              <h2 className="mt-7 font-display text-3xl font-black text-navy">{service.title}</h2>
              <p className="mt-4 leading-8 text-navy/66">{service.description}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {service.points.map((point) => (
                  <span key={point} className="rounded-full bg-ivory px-4 py-2 text-xs font-black text-navy/70">
                    {point}
                  </span>
                ))}
              </div>
            </Reveal>
          ))}
        </div>
      </section>
      <ContactForm />
    </main>
  );
}
