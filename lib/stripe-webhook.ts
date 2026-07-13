import { createHmac, timingSafeEqual } from "node:crypto";

export const STRIPE_WEBHOOK_TOLERANCE_SECONDS = 300;

export function verifyStripeWebhookSignature(
  rawBody: string,
  signature: string | null,
  webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "",
  nowSeconds = Date.now() / 1000,
) {
  if (!webhookSecret || !signature) return false;
  const timestamp = signature.match(/t=([^,]+)/)?.[1];
  const signatures = [...signature.matchAll(/v1=([^,]+)/g)].map((match) => match[1]);
  if (!timestamp || !signatures.length) return false;

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;
  if (Math.abs(nowSeconds - timestampSeconds) > STRIPE_WEBHOOK_TOLERANCE_SECONDS) return false;

  const expected = createHmac("sha256", webhookSecret).update(`${timestamp}.${rawBody}`).digest("hex");
  const expectedBuffer = Buffer.from(expected);
  return signatures.some((item) => {
    const signatureBuffer = Buffer.from(item);
    return signatureBuffer.length === expectedBuffer.length && timingSafeEqual(signatureBuffer, expectedBuffer);
  });
}

export function stripeEventMatchesConfiguredMode(
  livemode: boolean | undefined,
  stripeSecretKey = process.env.STRIPE_SECRET_KEY || "",
) {
  if (livemode == null || (!stripeSecretKey.startsWith("sk_live_") && !stripeSecretKey.startsWith("sk_test_"))) return false;
  return livemode === stripeSecretKey.startsWith("sk_live_");
}

export function assertStripeKeyForEnvironment(
  stripeSecretKey: string,
  vercelEnvironment = process.env.VERCEL_ENV,
) {
  const mode = stripeSecretKey.startsWith("sk_live_")
    ? "live"
    : stripeSecretKey.startsWith("sk_test_")
      ? "test"
      : null;

  if (!mode) throw new Error("STRIPE_SECRET_KEY n'est pas une clé Stripe secrète valide.");
  if (vercelEnvironment === "production" && mode !== "live") {
    throw new Error("La production refuse de créer une session Stripe avec une clé Test.");
  }
  return mode;
}
