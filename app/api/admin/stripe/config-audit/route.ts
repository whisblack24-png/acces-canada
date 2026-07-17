import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function keySummary(value: string) {
  if (!value) return { configured: false, mode: "absent", masked: null, fingerprint: null };
  const mode = value.startsWith("sk_test_") || value.startsWith("pk_test_")
    ? "test"
    : value.startsWith("sk_live_") || value.startsWith("pk_live_")
      ? "live"
      : "unknown";
  const prefix = value.split("_").slice(0, 2).join("_");
  return {
    configured: true,
    mode,
    masked: `${prefix}_••••${value.slice(-4)}`,
    fingerprint: createHash("sha256").update(value).digest("hex").slice(0, 16),
  };
}

async function stripeGet(path: string, secretKey: string) {
  const response = await fetch(`https://api.stripe.com${path}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Stripe audit HTTP ${response.status}`);
  return response.json() as Promise<Record<string, unknown>>;
}

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY || "";
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    || process.env.STRIPE_PUBLISHABLE_KEY
    || "";
  const secret = keySummary(secretKey);
  const publishable = keySummary(publishableKey);

  if (!secretKey) {
    return NextResponse.json({ secret, publishable, sameMode: false, account: null });
  }

  try {
    const [account, sessions] = await Promise.all([
      stripeGet("/v1/account", secretKey),
      stripeGet("/v1/checkout/sessions?limit=3", secretKey),
    ]);
    const recentSessions = Array.isArray(sessions.data)
      ? sessions.data.map((entry) => {
          const session = entry as Record<string, unknown>;
          return {
            id: session.id,
            livemode: session.livemode,
            paymentStatus: session.payment_status,
            amountTotal: session.amount_total,
            currency: session.currency,
            created: session.created,
          };
        })
      : [];
    return NextResponse.json({
      secret,
      publishable,
      sameMode: publishable.configured ? secret.mode === publishable.mode : null,
      account: {
        id: account.id,
        country: account.country,
        defaultCurrency: account.default_currency,
        businessName: (account.business_profile as Record<string, unknown> | undefined)?.name || null,
        email: account.email || null,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
      },
      recentSessions,
    });
  } catch (error) {
    console.error("[stripe-config-audit]", error);
    return NextResponse.json({
      error: "La configuration Stripe n’a pas pu être vérifiée.",
      secret,
      publishable,
    }, { status: 502 });
  }
}
