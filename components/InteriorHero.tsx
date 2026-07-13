import Image from "next/image";

type InteriorHeroProps = {
  eyebrow: string;
  title: string;
  text: string;
};

export function InteriorHero({ eyebrow, title, text }: InteriorHeroProps) {
  return (
    <section className="relative overflow-hidden bg-navy px-6 pb-20 pt-36 text-white">
      <Image src="/images/canada-skyline.webp" alt="" fill className="object-cover opacity-24" sizes="100vw" />
      <div className="absolute inset-0 bg-gradient-to-r from-navy via-navy/88 to-navy/54" />
      <div className="absolute inset-0 premium-grid opacity-15" />
      <div className="relative mx-auto max-w-7xl">
        <p className="text-sm font-black uppercase tracking-[0.28em] text-gold">{eyebrow}</p>
        <h1 className="mt-5 max-w-4xl font-display text-5xl font-black leading-tight md:text-7xl">{title}</h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-white/72">{text}</p>
      </div>
    </section>
  );
}
