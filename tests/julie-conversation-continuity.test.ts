import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("les pièces jointes sont importées avant que Julie réponde",()=>{
  const workspace=readFileSync("components/admin/JulieWorkspace.tsx","utf8");
  const send=workspace.slice(workspace.indexOf("async function send"),workspace.indexOf("async function importFiles"));
  assert.ok(send.indexOf("await importFiles(files)")<send.indexOf('fetch("/api/admin/julie"'));
  assert.match(send,/attachments:imported\.attachments/);
});

test("la conversation mémorise les documents récemment joints",()=>{
  const route=readFileSync("app/api/admin/julie/route.ts","utf8");
  const runtime=readFileSync("lib/julie-runtime.ts","utf8");
  assert.match(route,/recentDocuments:attachments/);
  assert.match(route,/contextualClientId=attachments\[0\]\?\.clientId\|\|activeClientId/);
  assert.match(runtime,/recentDocuments\?:Array/);
});

test("Julie peut rappeler immédiatement sa dernière tâche",()=>{
  const agent=readFileSync("lib/julie-agent.ts","utf8");
  assert.match(agent,/recallRequest/);
  assert.match(agent,/lastUserRequest/);
  assert.match(agent,/Dernière tâche retrouvée dans la mémoire persistante/);
});
