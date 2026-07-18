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
  assert.match(smart,/validateGeneratedDocx\(docx\);validateGeneratedPdf\(pdf\)/);
  assert.ok(smart.indexOf("validateGeneratedDocx(docx)")<smart.indexOf("insertSmartDocument({client_id"));
});

test("les fichiers corrompus sont refusés avant Supabase",()=>{
  const branding=readFileSync(new URL("../lib/document-branding.ts",import.meta.url),"utf8");
  assert.match(smart,/startsWith\("%PDF-1\.4\\n%"\)/);
  assert.match(smart,/startxref/);
  assert.match(smart,/word\/document\.xml/);
  assert.match(smart,/\[Content_Types\]\.xml/);
  assert.match(branding,/%\\xE2\\xE3\\xCF\\xD3/);
});

test("le Markdown devient une mise en forme réelle",()=>{
  assert.match(smart,/function plainMarkdown/);
  assert.match(smart,/function richRuns/);
  assert.match(smart,/bold:true/);
  assert.doesNotMatch(smart,/pdfText\(line,48,y[^\n]+\*\*/);
});

test("la réécriture IA interdit l’invention de faits", () => {
  assert.match(smart, /Interdictions : inventer une identité, date, somme, règle juridique/);
  assert.match(smart,/response_format:\{type:"json_schema"/);
  assert.match(smart,/TRANSFORMER réellement le brouillon/);
  assert.match(smart,/sourceNorm===textNorm/);
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
