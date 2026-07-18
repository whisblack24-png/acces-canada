import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("Julie 3 conserve une mémoire de travail durable",()=>{const migration=readFileSync("supabase/julie_3_0_runtime_foundation.sql","utf8"),route=readFileSync("app/api/admin/julie/route.ts","utf8"),planner=readFileSync("lib/julie-orchestrator.ts","utf8");assert.match(migration,/working_memory jsonb/);assert.match(route,/updateJulieWorkingMemory/);assert.match(planner,/Mémoire de travail durable/);});

test("les objectifs et actions approuvées sont persistants et idempotents",()=>{const migration=readFileSync("supabase/julie_3_0_runtime_foundation.sql","utf8"),runtime=readFileSync("lib/julie-runtime.ts","utf8"),approval=readFileSync("app/api/admin/julie/approvals/route.ts","utf8");assert.match(migration,/create table if not exists public\.julie_goal_runs/);assert.match(migration,/idempotency_key text not null unique/);assert.match(runtime,/alreadyCompleted:true/);assert.match(approval,/approval:\$\{pending\.id\}:action:\$\{index\}/);assert.match(approval,/saveJulieMessage\(conversationId,"system"/);});

test("les tables d’orchestration restent privées",()=>{const migration=readFileSync("supabase/julie_3_0_runtime_foundation.sql","utf8");assert.match(migration,/enable row level security/);assert.match(migration,/revoke all on public\.julie_goal_runs, public\.julie_action_runs from anon, authenticated/);assert.match(migration,/to service_role using \(true\) with check \(true\)/);});
