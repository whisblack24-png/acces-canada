import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { assertStripeKeyForEnvironment, stripeEventMatchesConfiguredMode, verifyStripeWebhookSignature } from "../lib/stripe-webhook.ts";

function signature(body: string, timestamp: number, secret: string) {
  const digest = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${digest}`;
}

test("le webhook accepte une signature Stripe récente et authentique", () => {
  const body = JSON.stringify({ id: "evt_test", type: "checkout.session.completed" });
  const now = 1_800_000_000;
  assert.equal(verifyStripeWebhookSignature(body, signature(body, now, "whsec_test"), "whsec_test", now), true);
});

test("le webhook refuse une signature expirée ou altérée", () => {
  const body = JSON.stringify({ id: "evt_test" });
  const now = 1_800_000_000;
  assert.equal(verifyStripeWebhookSignature(body, signature(body, now - 301, "whsec_test"), "whsec_test", now), false);
  assert.equal(verifyStripeWebhookSignature(`${body} `, signature(body, now, "whsec_test"), "whsec_test", now), false);
});

test("le mode de l'événement doit correspondre à la clé Stripe", () => {
  assert.equal(stripeEventMatchesConfiguredMode(false, "sk_test_example"), true);
  assert.equal(stripeEventMatchesConfiguredMode(true, "sk_live_example"), true);
  assert.equal(stripeEventMatchesConfiguredMode(true, "sk_test_example"), false);
  assert.equal(stripeEventMatchesConfiguredMode(false, "sk_live_example"), false);
});

test("le mode Stripe explicite conserve le paiement en Test", () => {
  assert.equal(assertStripeKeyForEnvironment("sk_test_example", "test"), "test");
  assert.equal(assertStripeKeyForEnvironment("sk_live_example", "live"), "live");
  assert.throws(
    () => assertStripeKeyForEnvironment("sk_live_example", "test"),
    /ne correspond pas au mode test/,
  );
});
