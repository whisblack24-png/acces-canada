import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const orchestrator = readFileSync(new URL("../lib/julie-orchestrator.ts", import.meta.url), "utf8");
const agent = readFileSync(new URL("../lib/julie-agent.ts", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../components/admin/JulieWorkspace.tsx", import.meta.url), "utf8");

test("Julie expose les outils CRM et documentaires de production", () => {
  for (const tool of ["search_records", "delete_client", "rename_document", "move_document", "delete_document", "update_task", "move_appointment", "cancel_appointment", "generate_report"]) {
    assert.match(orchestrator, new RegExp(`"${tool}"`));
    assert.match(agent, new RegExp(`"${tool}"`));
  }
});

test("les opérations irréversibles exigent toujours une approbation", () => {
  assert.match(agent, /alwaysSensitive=new Set\(\["delete_client","delete_document","cancel_appointment"\]\)/);
  assert.match(agent, /alwaysSensitive\.has\(planned\.tool\)\|\|/);
});

test("les plans multi-actions utilisent une approbation unique",()=>{
  const approvals=readFileSync(new URL("../app/api/admin/julie/approvals/route.ts",import.meta.url),"utf8");
  assert.match(agent,/payload:\{plannedActions:batchActions,instruction\}/);
  assert.match(agent,/Plan Julie à approuver/);
  assert.match(approvals,/pending\.payload\.plannedActions/);
  assert.match(approvals,/for\(const item of plannedActions\)/);
});

test("l’interface affiche la progression et les outils utilisés", () => {
  assert.match(workspace, /Traitement en cours/);
  assert.match(workspace, /Outils utilisés et résultats/);
  assert.match(workspace, /result\.tool\.replaceAll/);
});

test("l'interface formate les réponses et expose l'approbation groupée",()=>{
  const queue=readFileSync(new URL("../components/admin/JulieApprovalQueue.tsx",import.meta.url),"utf8");
  assert.match(queue,/Array\.isArray\(row\.payload\.plannedActions\)/);
  assert.match(queue,/Approuver et exécuter tout/);
  assert.match(workspace,/function JulieMessage/);
  assert.match(workspace,/inlineFormatting/);
  assert.match(workspace,/part\.slice\(2,-2\)/);
  assert.match(workspace,/<JulieMessage content=\{entry\.content\}/);
});
