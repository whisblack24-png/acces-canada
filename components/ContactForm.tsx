"use client";

import { motion } from "framer-motion";
import { CalendarDays, Mail, MapPin, Phone, Send } from "lucide-react";
import { brand, contactMethods } from "@/lib/site";

export function ContactForm() {
  return (
    <section id="contact-form" className="bg-ivory px-6 py-24">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.88fr_1.12fr] lg:items-stretch">
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="rounded-[2rem] bg-navy p-8 text-white shadow-premium md:p-10"
        >
          <p className="text-sm font-black uppercase tracking-[0.26em] text-gold">Contact</p>
          <h2 className="mt-5 font-display text-4xl font-black leading-tight md:text-5xl">
            Parlons de votre projet canadien.
          </h2>
          <p className="mt-6 leading-8 text-white/68">
            Partagez votre situation, votre objectif et votre calendrier. Accès Canada vous répond avec une première
            orientation claire et professionnelle.
          </p>

          <div className="mt-10 space-y-4">
            {contactMethods.map((method) => (
              <a
                key={method.label}
                href={method.href}
                className="flex items-center gap-4 rounded-2xl bg-white/8 p-4 transition hover:bg-white/12"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gold text-navy">
                  <method.icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-xs font-black uppercase tracking-[0.18em] text-white/42">{method.label}</span>
                  <span className="mt-1 block font-bold">{method.value}</span>
                </span>
              </a>
            ))}
          </div>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, x: 24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="rounded-[2rem] bg-white p-6 shadow-premium md:p-10"
        >
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Nom complet" placeholder="Votre nom" />
            <Field label="Email" type="email" placeholder="vous@email.com" icon={<Mail className="h-4 w-4" />} />
            <Field label="Téléphone" placeholder="+1 ..." icon={<Phone className="h-4 w-4" />} />
            <label className="text-sm font-bold text-navy/75">
              Service souhaité
              <select className="mt-2 w-full rounded-2xl border border-navy/10 bg-ivory px-4 py-4 text-navy outline-none transition focus:border-gold">
                <option>Études au Canada</option>
                <option>Travail et carrière</option>
                <option>Dossiers d'immigration</option>
                <option>Installation au Canada</option>
                <option>Conseil personnalisé</option>
              </select>
            </label>
            <Field label="Pays de résidence" placeholder="Votre pays actuel" icon={<MapPin className="h-4 w-4" />} />
            <Field label="Date souhaitée" type="date" icon={<CalendarDays className="h-4 w-4" />} />
          </div>

          <label className="mt-5 block text-sm font-bold text-navy/75">
            Message
            <textarea
              className="mt-2 min-h-36 w-full rounded-2xl border border-navy/10 bg-ivory px-4 py-4 text-navy outline-none transition placeholder:text-navy/35 focus:border-gold"
              placeholder="Décrivez votre objectif, votre situation et vos questions principales."
            />
          </label>

          <motion.button
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-canada px-7 py-3 text-sm font-black text-white shadow-[0_18px_45px_rgba(200,16,46,0.22)] transition hover:bg-navy"
          >
            Envoyer la demande
            <Send className="h-4 w-4" />
          </motion.button>
          <p className="mt-4 text-xs leading-6 text-navy/48">
            Ce formulaire prépare votre première prise de contact. Vous pouvez aussi écrire directement à {brand.email}.
          </p>
        </motion.form>
      </div>
    </section>
  );
}

function Field({
  label,
  placeholder,
  type = "text",
  icon
}: {
  label: string;
  placeholder?: string;
  type?: string;
  icon?: React.ReactNode;
}) {
  return (
    <label className="text-sm font-bold text-navy/75">
      {label}
      <span className="relative mt-2 block">
        {icon ? <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-navy/35">{icon}</span> : null}
        <input
          type={type}
          className={`w-full rounded-2xl border border-navy/10 bg-ivory px-4 py-4 text-navy outline-none transition placeholder:text-navy/35 focus:border-gold ${icon ? "pl-11" : ""}`}
          placeholder={placeholder}
        />
      </span>
    </label>
  );
}
