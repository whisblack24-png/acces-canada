"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { CheckCircle2, CreditCard } from "lucide-react";

const calendlyUrl =
  "https://calendly.com/accesc625/30min?locale=fr&hide_gdpr_banner=1&primary_color=d4af37&text_color=0b1d36";

function isCalendlyEvent(event: MessageEvent) {
  return event.origin === "https://calendly.com" && typeof event.data?.event === "string";
}

export function CalendlyBooking() {
  const [scheduled, setScheduled] = useState(false);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (isCalendlyEvent(event) && event.data.event === "calendly.event_scheduled") {
        setScheduled(true);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return (
    <>
      <div className="border-b border-navy/10 px-5 py-4 md:px-7">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-canada">Calendrier de réservation</p>
        <p className="mt-2 text-sm leading-6 text-navy/58">
          Sélectionnez une date, une heure, puis confirmez vos informations directement dans le calendrier.
        </p>
      </div>

      <div className="mx-5 mt-5 flex items-start gap-4 rounded-2xl border border-gold/35 bg-[#FBF7EA] px-5 py-4 text-navy shadow-[0_18px_45px_rgba(11,29,54,0.08)] md:mx-7">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gold text-navy">
          <CreditCard className="h-5 w-5" />
        </span>
        <span>
          <span className="block text-sm font-black uppercase tracking-[0.18em] text-canada">
            Paiement de la consultation
          </span>
          <span className="mt-2 block text-sm leading-6 text-navy/72">
            Selon le type de consultation choisi, un paiement sécurisé peut être demandé au moment de la réservation via
            Stripe. Le paiement est entièrement sécurisé et votre rendez-vous sera confirmé une fois la réservation
            complétée.
          </span>
        </span>
      </div>

      {scheduled ? (
        <div className="mx-5 mt-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800 md:mx-7">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <span>
            Votre rendez-vous a bien été pris en compte. Vous recevrez une confirmation par e-mail avec les détails de
            la consultation.
          </span>
        </div>
      ) : null}

      <div
        className="calendly-inline-widget min-w-[320px]"
        data-url={calendlyUrl}
        style={{ height: "700px" }}
      />
      <Script src="https://assets.calendly.com/assets/external/widget.js" strategy="afterInteractive" />
    </>
  );
}
