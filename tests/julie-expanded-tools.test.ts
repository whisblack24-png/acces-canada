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

test("l’interface affiche la progression et les outils utilisés", () => {
  assert.match(workspace, /Traitement en cours/);
  assert.match(workspace, /Outils utilisés et résultats/);
  assert.match(workspace, /result\.tool\.replaceAll/);
});
