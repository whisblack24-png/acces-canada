import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const orchestrator=readFileSync(new URL("../lib/julie-orchestrator.ts",import.meta.url),"utf8");
const agent=readFileSync(new URL("../lib/julie-agent.ts",import.meta.url),"utf8");

test("Julie utilise un plan d'outils structuré produit par le modèle",()=>{
  assert.match(orchestrator,/response_format:\s*\{ type: "json_schema"/);
  assert.match(orchestrator,/maxItems: 8/);
  assert.match(agent,/for \(const planned of plan\.actions\)/);
});

test("la création d'un nouveau client isole le client actif et contrôle les doublons",()=>{
  assert.match(orchestrator,/scope === "new_client"/);
  assert.match(orchestrator,/ignoreActiveClient = true/);
  assert.match(agent,/plan\.ignoreActiveClient \? undefined : selectedClientId/);
  assert.match(agent,/Doublon potentiel à confirmer/);
});

test("chaque outil retourne un état explicite",()=>{
  assert.match(agent,/"completed" \| "needs_input" \| "failed"/);
  assert.match(agent,/actions: executions\.flatMap/);
});
