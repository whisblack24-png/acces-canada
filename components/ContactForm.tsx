"use client";

import { FormEvent, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, CheckCircle2, Mail, MapPin, Phone, Send } from "lucide-react";
import { brand, contactMethods } from "@/lib/site";

type SubmitState = "idle" | "loading" | "success" | "error";

export function ContactForm() {
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [feedback, setFeedback] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    setSubmitState("loading");
    setFeedback("");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          email: formData.get("email"),
          phone: formData.get("phone"),
          service: formData.get("service"),
          country: formData.get("country"),
          preferredDate: formData.get("preferredDate"),
          message: formData.get("message"),
        }),
      });

      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(result.message || "Impossible d'envoyer la demande.");
      }

      setSubmitState("success");
      setFeedback(result.message || "Votre demande a bien été envoyée.");
      form.reset();
    } catch (error) {
      setSubmitState("error");
      setFeedback(error instanceof Error ? error.message : "Impossible d'envoyer la demande.");
    }
  }

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
          onSubmit={handleSubmit}
          initial={{ opacity: 0, x: 24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="rounded-[2rem] bg-white p-6 shadow-premium md:p-10"
        >
          <div className="grid gap-5 md:grid-cols-2">
            <Field name="name" label="Nom complet" placeholder="Votre nom" required />
            <Field name="email" label="Email" type="email" placeholder="vous@email.com" icon={<Mail className="h-4 w-4" />} required />
            <Field name="phone" label="Téléphone" placeholder="+1 ..." icon={<Phone className="h-4 w-4" />} />
            <label className="text-sm font-bold text-navy/75">
              Service souhaité
              <select
                name="service"
                required
                className="mt-2 w-full rounded-2xl border border-navy/10 bg-ivory px-4 py-4 text-navy outline-none transition focus:border-gold"
              >
                <option>Études au Canada</option>
                <option>Travail et carrière</option>
                <option>Dossiers d'immigration</option>
                <option>Installation au Canada</option>
                <option>Conseil personnalisé</option>
              </select>
            </label>
            <Field name="country" label="Pays de résidence" placeholder="Votre pays actuel" icon={<MapPin className="h-4 w-4" />} />
            <Field name="preferredDate" label="Date souhaitée" type="date" icon={<CalendarDays className="h-4 w-4" />} />
          </div>

          <label className="mt-5 block text-sm font-bold text-navy/75">
            Message
            <textarea
              name="message"
              required
              className="mt-2 min-h-36 w-full rounded-2xl border border-navy/10 bg-ivory px-4 py-4 text-navy outline-none transition placeholder:text-navy/35 focus:border-gold"
              placeholder="Décrivez votre objectif, votre situation et vos questions principales."
            />
          </label>

          {feedback ? (
            <div
              role="status"
              className={`mt-5 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-bold ${
                submitState === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-canada/20 bg-canada/5 text-canada"
              }`}
            >
              {submitState === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : null}
              <span>{feedback}</span>
            </div>
          ) : null}

          <motion.button
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={submitState === "loading"}
            className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-canada px-7 py-3 text-sm font-black text-white shadow-[0_18px_45px_rgba(200,16,46,0.22)] transition hover:bg-navy disabled:cursor-not-allowed disabled:bg-navy/45"
          >
            {submitState === "loading" ? "Envoi en cours..." : "Envoyer la demande"}
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
  name,
  label,
  placeholder,
  type = "text",
  icon,
  required = false,
}: {
  name: string;
  label: string;
  placeholder?: string;
  type?: string;
  icon?: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="text-sm font-bold text-navy/75">
      {label}
      <span className="relative mt-2 block">
        {icon ? <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-navy/35">{icon}</span> : null}
        <input
          name={name}
          type={type}
          required={required}
          className={`w-full rounded-2xl border border-navy/10 bg-ivory px-4 py-4 text-navy outline-none transition placeholder:text-navy/35 focus:border-gold ${icon ? "pl-11" : ""}`}
          placeholder={placeholder}
        />
      </span>
    </label>
  );
}
