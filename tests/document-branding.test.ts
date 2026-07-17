import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

test("le cachet officiel respecte les textes approuvés et possède toutes ses variantes", () => {
  for (const name of ["seal-official", "seal-monochrome", "seal-signed"]) {
    assert.equal(existsSync(`public/brand/${name}.svg`), true);
    assert.equal(existsSync(`public/brand/${name}.png`), true);
  }
  const seal = readFileSync("public/brand/seal-official.svg", "utf8");
  assert.match(seal, /ACCÈS CANADA/);
  assert.match(seal, /DOCUMENT OFFICIEL/);
  assert.doesNotMatch(seal, /IMMIGRATION|DEPUIS 2026/i);
  assert.doesNotMatch(seal, /SIGNÉ NUMÉRIQUEMENT|SIGNATURE NUMÉRIQUE/i);
});

test("les documents disposent des signatures, du cachet, du QR et du pied de page commun", () => {
  const branding = readFileSync("lib/document-branding.ts", "utf8");
  const documents = readFileSync("lib/pdf-documents.ts", "utf8");
  const adminDownload = readFileSync("app/api/admin/documents/[id]/download/route.ts", "utf8");
  assert.match(branding, /Christian Nkuli Mboyo/);
  assert.match(branding, /Me Régine Sifa Buledi/);
  assert.match(branding, /Signature du client/);
  assert.equal(existsSync("public/brand/signature-director.png"), true);
  assert.match(branding, /VÉRIFICATION DU DOCUMENT/);
  assert.doesNotMatch(branding, /SIGNÉ NUMÉRIQUEMENT|SIGNATURE NUMÉRIQUE/i);
  assert.match(branding, /Empreinte SHA-256/);
  assert.match(branding, /Document confidentiel - Acces Canada/);
  assert.match(branding, /Page.*sur/);
  assert.match(branding, /verificationUrl/);
  assert.match(documents, /digitalSignatureCertificateCommands/);
  assert.match(adminDownload, /authenticityHash: document\.authenticity_hash/);
  assert.match(adminDownload, /digitallySigned: true/);
});

test("Régine ne reçoit jamais une fausse signature et son PNG reste administrable",()=>{
  const branding=readFileSync("lib/document-branding.ts","utf8");
  const settings=readFileSync("lib/signature-settings.ts","utf8");
  const page=readFileSync("components/admin/SignatureSettingsPanel.tsx","utf8");
  assert.doesNotMatch(branding,/signaturePath|125 165 c 112 230/);
  assert.match(branding,/pdfLine\(x,y\+45/);
  assert.match(settings,/Le PNG doit contenir un fond transparent/);
  assert.match(page,/Aucune signature réelle importée/);
  assert.match(page,/Désactiver temporairement/);
  assert.match(page,/Importer le PNG/);
});

test("les paramètres de signatures sont privés et idempotents",()=>{
  const migration=readFileSync("supabase/document_signature_settings.sql","utf8");
  assert.match(migration,/create table if not exists public\.document_signature_settings/i);
  assert.match(migration,/enable row level security/i);
  assert.match(migration,/revoke all.*anon, authenticated/i);
  assert.match(migration,/public,file_size_limit[\s\S]*false,3145728/);
  assert.doesNotMatch(migration,/\b(delete from|truncate|drop table)\b/i);
});

test("la convention officielle couvre toutes les clauses contractuelles attendues", () => {
  const documents = readFileSync("lib/pdf-documents.ts", "utf8");
  assert.match(documents, /Convention de services Accès Canada/);
  for (const clause of [
    "Description détaillée du mandat",
    "Services inclus",
    "Honoraires et modalités de paiement",
    "Responsabilités du client",
    "Responsabilités d'Accès Canada",
    "Confidentialité et renseignements personnels",
    "Annulation et remboursement",
    "Durée du mandat",
    "Consentements",
    "Communications électroniques",
    "Conditions générales",
    "Acceptation",
  ]) assert.match(documents, new RegExp(clause.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("la génération intelligente couvre neuf types de dossiers et les modèles essentiels",()=>{
  const documents=readFileSync("lib/pdf-documents.ts","utf8");
  const manager=readFileSync("components/admin/DocumentsManager.tsx","utf8");
  for(const type of ["visa_visiteur","permis_etudes","permis_travail","residence_permanente","parrainage","citoyennete","demande_asile","renouvellement","autre"])assert.match(documents,new RegExp(type));
  assert.match(documents,/procuration/);
  assert.match(documents,/lettre-autorisation/);
  assert.match(manager,/Documentation recommandée/);
  assert.match(manager,/questionnaires intelligents/i);
});

test("la bibliothèque professionnelle propose recherche, favoris, aperçu, duplication, versions et archivage",()=>{
  const manager=readFileSync("components/admin/LibraryManager.tsx","utf8");
  const migration=readFileSync("supabase/document_system_final_v4.sql","utf8");
  for(const feature of ["Rechercher","Favoris","Aperçu","Dupliquer","Archiver","Version"])assert.match(manager,new RegExp(feature,"i"));
  for(const column of ["is_favorite","version","parent_template_id","archived_at"])assert.match(migration,new RegExp(column));
  assert.doesNotMatch(migration,/\b(delete from|truncate|drop table)\b/i);
});

test("la migration d'authenticité est additive, idempotente et préserve les archives", () => {
  const migration = readFileSync("supabase/document_authenticity_v3.sql", "utf8");
  assert.match(migration, /add column if not exists document_number/i);
  assert.match(migration, /verification_token uuid default gen_random_uuid/i);
  assert.match(migration, /authenticity_hash/i);
  assert.match(migration, /on delete cascade not valid/i);
  assert.match(migration, /revoke all.*anon,authenticated/i);
  assert.doesNotMatch(migration, /\b(delete from|truncate|drop table)\b/i);
});
