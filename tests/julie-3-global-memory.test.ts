import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("Julie conserve une mémoire globale privée et dédupliquée",()=>{const sql=readFileSync("supabase/julie_3_1_global_memory.sql","utf8"),runtime=readFileSync("lib/julie-runtime.ts","utf8");assert.match(sql,/julie_global_memories/);assert.match(sql,/dedupe_key text not null unique/);assert.match(sql,/enable row level security/);assert.match(sql,/revoke all .* from anon, authenticated/);assert.match(runtime,/rememberJulieOutcome/);assert.match(runtime,/resolution=merge-duplicates/);});

test("la mémoire globale alimente le planificateur",()=>{const route=readFileSync("app/api/admin/julie/route.ts","utf8"),planner=readFileSync("lib/julie-orchestrator.ts","utf8");assert.match(route,/listJulieGlobalMemory/);assert.match(planner,/Mémoire globale pertinente/);assert.match(planner,/globalMemory/);});

test("l’interface présente les missions et leurs étapes persistantes",()=>{const workspace=readFileSync("components/admin/JulieWorkspace.tsx","utf8"),route=readFileSync("app/api/admin/julie/route.ts","utf8");assert.match(workspace,/Mission actuelle/);assert.match(workspace,/runtime\.actions/);assert.match(route,/getJulieRuntimeState/);});
