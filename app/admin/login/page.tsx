import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/LoginForm";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { brand } from "@/lib/site";

export const metadata: Metadata = {
  title: "Connexion administration",
  description: "Connexion sécurisée à l'espace d'administration Accès Canada.",
};

export default async function AdminLoginPage() {
  if (await isAdminAuthenticated()) {
    redirect("/admin");
  }

  return (
    <main className="min-h-screen bg-navy px-6 py-16 text-navy">
      <div className="absolute inset-0 premium-grid opacity-10" />
      <div className="relative mx-auto grid min-h-[calc(100vh-8rem)] max-w-6xl items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="text-white">
          <Image src="/images/logo.png" alt="Accès Canada" width={92} height={92} className="rounded-3xl" />
          <p className="mt-8 text-sm font-black uppercase tracking-[0.26em] text-gold">Espace administrateur</p>
          <h1 className="mt-5 font-display text-5xl font-black leading-tight md:text-7xl">Pilotage Accès Canada.</h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-white/68">
            Connectez-vous pour gérer les clients, suivre les dossiers et préparer l'évolution vers les documents,
            paiements et intégrations métier.
          </p>
        </section>

        <section className="rounded-[2rem] bg-white p-7 shadow-premium md:p-10">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-canada">Connexion sécurisée</p>
          <h2 className="mt-4 font-display text-4xl font-black text-navy">{brand.name}</h2>
          <p className="mt-3 leading-7 text-navy/58">Accès réservé aux administrateurs autorisés.</p>
          <LoginForm />
        </section>
      </div>
    </main>
  );
}
