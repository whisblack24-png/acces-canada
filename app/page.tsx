import Image from "next/image";
import Link from "next/link";
import { CalendarCheck, ArrowRight, LockKeyhole } from "lucide-react";

export default function Home() {
  return (
    <main className="bg-white">
      <section className="relative min-h-screen overflow-hidden">
        <Image src="/images/canada-skyline.webp" alt="Panorama urbain canadien" fill priority sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-32 text-center">
          <Image src="/images/logo.png" alt="Accès Canada" width={140} height={140} className="mb-8 rounded-3xl" />
          <h1 className="max-w-5xl text-5xl font-black leading-tight text-white md:text-7xl">
            Votre passerelle vers le Canada
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-white/82 md:text-xl">
            Cabinet professionnel spécialisé en immigration, études, permis de travail et accompagnement vers le Canada.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:flex-wrap">
            <Link
              href="/rendez-vous"
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-gold px-8 py-4 text-sm font-black text-navy shadow-[0_18px_45px_rgba(212,175,55,0.26)] transition hover:-translate-y-1 hover:bg-white"
            >
              <CalendarCheck className="h-5 w-5" />
              Prendre rendez-vous
            </Link>
            <Link
              href="/services"
              className="inline-flex min-h-12 items-center gap-2 rounded-full border-2 border-white px-8 py-4 text-sm font-black text-white transition hover:-translate-y-1 hover:bg-white hover:text-navy"
            >
              Nos services
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/client/login"
              className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/30 bg-white/10 px-8 py-4 text-sm font-black text-white backdrop-blur transition hover:-translate-y-1 hover:bg-white hover:text-navy"
            >
              <LockKeyhole className="h-5 w-5" />
              Espace client
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-ivory px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-10 text-center font-display text-4xl font-black text-navy">Nos services</h2>
          <div className="grid gap-6 md:grid-cols-4">
            {[
              ["Études", "Admission dans les universités canadiennes"],
              ["Travail", "Permis de travail et carrière"],
              ["Immigration", "Résidence permanente"],
              ["Installation", "Accompagnement avant et après arrivée"],
            ].map(([title, text]) => (
              <div key={title} className="rounded-2xl border border-navy/10 bg-white p-6 shadow-premium">
                <h3 className="mb-3 text-xl font-black text-navy">{title}</h3>
                <p className="leading-7 text-navy/62">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-navy px-6 py-16 text-center text-white">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-display text-4xl font-black">Prêt à clarifier votre projet ?</h2>
          <p className="mx-auto mt-4 max-w-2xl leading-8 text-white/68">
            Réservez une consultation en ligne et échangez avec Accès Canada sur votre parcours.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/rendez-vous"
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-canada px-8 py-4 text-sm font-black text-white transition hover:-translate-y-1 hover:bg-gold hover:text-navy"
            >
              <CalendarCheck className="h-5 w-5" />
              Prendre rendez-vous
            </Link>
            <Link
              href="/client/login"
              className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/20 px-8 py-4 text-sm font-black text-white transition hover:-translate-y-1 hover:bg-white hover:text-navy"
            >
              <LockKeyhole className="h-5 w-5" />
              Accéder à mon dossier
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
