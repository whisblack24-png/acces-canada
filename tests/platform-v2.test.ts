import assert from "node:assert/strict"; import test from "node:test"; import { cleanSearch } from "../lib/platform-v2.ts";
test("la recherche universelle neutralise les opérateurs PostgREST",()=>{assert.equal(cleanSearch("  Dupont,(*% dossier)  "),"Dupont dossier");assert.equal(cleanSearch("a".repeat(100)).length,80)});
