import type { Metadata } from "next";
import { InteriorHero } from "@/components/InteriorHero";
import { Reveal } from "@/components/Reveal";
import { SectionTitle } from "@/components/SectionTitle";
import { process, values } from "@/lib/site";

export const metadata: Metadata = {
  title: "À propos",
  description: "Découvrez Accès Canada, cabinet de conseil premium pour vos projets d'études, de travail et d'installation au Canada."
};

export default function AboutPage() {
  return (
    <main>
      <InteriorHero
        eyebrow="À propos"
        title="Un partenaire de confiance pour votre avenir au Canada."
        text="Accès Canada accompagne les projets de mobilité avec une méthode claire, une écoute sérieuse et une approche résolument professionnelle."
      />

      <section className="bg-ivory px-6 py-24">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <Reveal>
            <SectionTitle
              eyebrow="Notre histoire"
              title="Un accompagnement humain pour des décisions importantes."
              text="Nous aidons nos clients à transformer une ambition en plan d'action. Notre rôle est de clarifier, structurer et accompagner chaque étape avec professionnalisme."
              align="left"
            />
          </Reveal>
          <div className="grid gap-5 md:grid-cols-2">
            {process.map((step, index) => (
              <Reveal key={step.title} delay={index * 0.06} className="rounded-[1.5rem] bg-white p-6 shadow-premium">
                <step.icon className="h-8 w-8 text-gold" />
                <h2 className="mt-5 text-xl font-black text-navy">{step.title}</h2>
                <p className="mt-3 leading-7 text-navy/64">{step.text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-6 py-24">
        <SectionTitle
          eyebrow="Mission, vision, valeurs"
          title="Une marque bâtie sur la clarté et la confiance."
          text="Accès Canada combine rigueur, élégance et proximité pour créer une expérience de conseil rassurante."
        />
        <div className="mx-auto mt-14 grid max-w-7xl gap-6 md:grid-cols-3">
          {values.map((value, index) => (
            <Reveal key={value.title} delay={index * 0.08} className="rounded-[1.75rem] bg-ivory p-8 shadow-premium">
              <value.icon className="h-9 w-9 text-gold" />
              <h2 className="mt-6 text-xl font-black text-navy">{value.title}</h2>
              <p className="mt-4 leading-7 text-navy/64">{value.text}</p>
            </Reveal>
          ))}
        </div>
      </section>
    </main>
  );
}
