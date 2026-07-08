import type { Metadata } from "next";
import { ContactForm } from "@/components/ContactForm";
import { FAQAccordion } from "@/components/FAQAccordion";
import { InteriorHero } from "@/components/InteriorHero";
import { SectionTitle } from "@/components/SectionTitle";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Questions fréquentes sur les services Accès Canada, les consultations et l'accompagnement vers le Canada."
};

export default function FAQPage() {
  return (
    <main>
      <InteriorHero
        eyebrow="FAQ"
        title="Les réponses aux questions les plus fréquentes."
        text="Comprenez rapidement comment démarrer, quels services sont proposés et comment se déroule l'accompagnement."
      />
      <section className="bg-ivory px-6 py-24">
        <SectionTitle
          eyebrow="Questions"
          title="Informations utiles avant de commencer."
          text="Ces réponses vous donnent une première base. Pour une analyse personnalisée, contactez Accès Canada."
        />
        <div className="mt-14">
          <FAQAccordion />
        </div>
      </section>
      <ContactForm />
    </main>
  );
}
