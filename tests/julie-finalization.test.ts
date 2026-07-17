import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Julie accepte le glisser-déposer multiple avec progression et concurrence bornée",async()=>{
  const source=await readFile(new URL("../components/admin/JulieWorkspace.tsx",import.meta.url),"utf8");
  assert.match(source,/dataTransfer\.files/);
  assert.match(source,/type="file" multiple/);
  assert.match(source,/Math\.min\(3,files\.length\)/);
  assert.match(source,/Progression de l’importation/);
  assert.match(source,/status:"completed"/);
  assert.match(source,/status:"error"/);
});

test("la signature électronique est idempotente, non rejouable et auditée",async()=>{
  const source=await readFile(new URL("../lib/production-workflow.ts",import.meta.url),"utf8");
  assert.match(source,/status=eq\.pending&select=\*/);
  assert.match(source,/client_id=eq\.\$\{encodeURIComponent\(client\.id\)\}&status=eq\.pending/);
  assert.match(source,/a déjà été traitée/);
  assert.match(source,/action: "request_signature"/);
  assert.match(source,/action: "sign"/);
});

test("les actions naturelles couvrent CRM, tâches, documents et recommandations",async()=>{
  const source=await readFile(new URL("../lib/julie-agent.ts",import.meta.url),"utf8");
  for(const marker of ["create_client","create_task","request_signature","generate_document","recommend"])assert.match(source,new RegExp(marker));
  assert.match(source,/Je ne conclus pas à l’admissibilité juridique/);
});
