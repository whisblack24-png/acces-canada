import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("le diagnostic Stripe reste administratif et ne retourne jamais les clés brutes", () => {
  const route = readFileSync(new URL("../app/api/admin/stripe/config-audit/route.ts", import.meta.url), "utf8");
  assert.match(route, /isAdminAuthenticated/);
  assert.match(route, /createHash\("sha256"\)/);
  assert.match(route, /masked:/);
  assert.doesNotMatch(route, /secretKey,\s*publishableKey/);
  assert.match(route, /\/v1\/account/);
  assert.match(route, /\/v1\/checkout\/sessions\?limit=3/);
});
