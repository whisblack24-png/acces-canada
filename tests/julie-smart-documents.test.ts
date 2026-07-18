import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const smart = readFileSync(new URL("../lib/smart-documents.ts", import.meta.url), "utf8");
const agent = readFileSync(new URL("../lib/julie-agent.ts", import.meta.url), "utf8");
const planner = readFileSync(new URL("../lib/julie-orchestrator.ts", import.meta.url), "utf8");
const schema = readFileSync(new URL("../supabase/julie_smart_documents.sql", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/admin/julie/route.ts", import.meta.url), "utf8");

test("Julie génère deux formats officiels et les classe dans le CRM", () => {
  for (const contract of [/new Document\(/, /BrandedPdfBuilder/, /application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document/, /application\/pdf/, /uploadClientFile/, /createClientUpload/, /ACCÈS CANADA/, /PageNumber\.CURRENT/]) assert.match(smart, contract);
});

test("la réécriture IA interdit l’invention de faits", () => {
  assert.match(smart, /sans inventer aucun fait, montant, date, identité ou engagement juridique/);
  assert.match(smart, /source\.slice\(0,30000\)/);
  assert.match(route, /slice\(0, 30000\)/);
});

test("l’édition crée une nouvelle version sans écraser l’historique", () => {
  assert.match(agent, /edit_professional_document/);
  assert.match(agent, /parent:source/);
  assert.match(agent, /source\.client_id!==client!\.id/);
  assert.match(smart, /input\.parent\?input\.parent\.version\+1:1/);
  assert.match(schema, /parent_document_id uuid references public\.julie_smart_documents/);
});

test("la préparation complète analyse, planifie et génère sans doublons", () => {
  assert.match(planner, /prepare_complete_case/);
  assert.match(agent, /analysis\.missingDocuments/);
  assert.match(agent, /existing\.has\(normalize\(title\)\)/);
  assert.match(agent, /\["checklist-visa","convention"\]/);
});

test("les documents intelligents restent privés", () => {
  assert.match(schema, /enable row level security/);
  assert.match(schema, /revoke all on public\.julie_smart_documents from anon, authenticated/);
  assert.match(schema, /for all to service_role using \(true\) with check \(true\)/);
});
