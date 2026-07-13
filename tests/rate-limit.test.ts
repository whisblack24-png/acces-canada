import assert from "node:assert/strict";
import test from "node:test";
import { checkRateLimit } from "../lib/rate-limit.ts";

test("rate limiter allows requests up to the configured limit", () => {
  const key = `allowed-${Date.now()}`;
  assert.equal(checkRateLimit(key, 2, 60_000, 1_000).allowed, true);
  assert.equal(checkRateLimit(key, 2, 60_000, 1_001).allowed, true);
  assert.equal(checkRateLimit(key, 2, 60_000, 1_002).allowed, false);
});

test("rate limiter resets after its window", () => {
  const key = `reset-${Date.now()}`;
  assert.equal(checkRateLimit(key, 1, 1_000, 1_000).allowed, true);
  assert.equal(checkRateLimit(key, 1, 1_000, 1_500).allowed, false);
  assert.equal(checkRateLimit(key, 1, 1_000, 2_001).allowed, true);
});
