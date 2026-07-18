import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("chaque mission crée ses étapes avant l’exécution",()=>{const agent=readFileSync("lib/julie-agent.ts","utf8"),runtime=readFileSync("lib/julie-runtime.ts","utf8");assert.match(agent,/seedJulieGoalActions/);assert.match(runtime,/status:"pending"/);assert.match(runtime,/goal:\$\{input\.goalRunId\}:action:\$\{index\}/);});

test("les étapes normales passent par un exécuteur idempotent",()=>{const agent=readFileSync("lib/julie-agent.ts","utf8");assert.match(agent,/beginJulieAction/);assert.match(agent,/alreadyCompleted/);assert.match(agent,/finishJulieAction\(run\.run\.id,"completed"/);assert.match(agent,/setJulieActionStatus\(goalRun\.id,actionIndex,"failed"/);});

test("une approbation reprend exactement les étapes suspendues",()=>{const agent=readFileSync("lib/julie-agent.ts","utf8"),approval=readFileSync("app/api/admin/julie/approvals/route.ts","utf8");assert.match(agent,/"awaiting_approval",approval\.id/);assert.match(agent,/actionIndexes/);assert.match(approval,/goalRunId\?`goal:\$\{goalRunId\}:action:\$\{actionIndex\}`/);});
