import assert from "node:assert/strict";
import test from "node:test";
import { appointmentConfirmationEmailHtml } from "../lib/appointment-confirmation-email.ts";

test("le courriel premium contient toutes les informations et actions attendues", () => {
  const html = appointmentConfirmationEmailHtml({
    clientName: "Christian Nkuli Mboyo",
    consultation: "Consultation de 60 minutes",
    date: "15 juillet 2026",
    time: "10 h 00",
    duration: "60 minutes",
    mode: "Visioconférence",
    bookingReference: "AC-RDV-2026-0042",
    invoiceNumber: "AC-FAC-2026-0042",
    amount: "100,00 $ US",
    invoiceUrl: "https://acces-canada.vercel.app/facture.pdf",
    portalUrl: "https://acces-canada.vercel.app/client/login",
    contactUrl: "https://acces-canada.vercel.app/contact",
  });

  for (const expected of [
    "Votre rendez-vous est confirmé",
    "Paiement confirmé",
    "Réservation confirmée",
    "Christian Nkuli Mboyo",
    "AC-RDV-2026-0042",
    "AC-FAC-2026-0042",
    "Télécharger la facture PDF",
    "Accéder à mon espace client",
    "Contacter Accès Canada",
    "cid:acces-canada-logo",
    "cid:acces-canada-qr",
  ]) {
    assert.match(html, new RegExp(expected));
  }
});
