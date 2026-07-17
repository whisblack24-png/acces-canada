import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../components/BookingForm.tsx", import.meta.url), "utf8");

test("la confirmation Stripe reste affichée jusqu’à une action du client", () => {
  assert.doesNotMatch(source, /location\.assign\("\/"\)/);
  assert.doesNotMatch(source, /redirectSeconds|Redirection automatique/);
  assert.match(source, /Retourner à l’accueil/);
  assert.match(source, /Accéder à mon espace client/);
  assert.match(source, /Télécharger ma facture/);
});

test("la confirmation attend durablement la source de vérité webhook", () => {
  assert.match(source, /setTimeout\(checkStatus, attempt < 15 \? 2_000 : 5_000\)/);
  assert.match(source, /Cette page se met à jour automatiquement/);
  assert.match(source, /Le code d’accès au portail client expire après 10 minutes/);
});
