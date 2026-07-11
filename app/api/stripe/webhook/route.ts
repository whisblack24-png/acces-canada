import { NextResponse } from "next/server";
import { confirmAppointmentFromStripeSession } from "@/lib/booking";
import { markPaymentPaid, verifyStripeWebhookSignature } from "@/lib/production-workflow";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!(await verifyStripeWebhookSignature(rawBody, signature))) {
    return NextResponse.json({ message: "Signature Stripe invalide." }, { status: 400 });
  }

  try {
    const event = JSON.parse(rawBody) as {
      type?: string;
      data?: {
        object?: {
          id?: string;
          payment_status?: string | null;
          payment_intent?: string | null;
          payment_method_types?: string[];
          metadata?: Record<string, string | undefined> | null;
        };
      };
    };

    if (event.type === "checkout.session.completed" && event.data?.object?.id) {
      if (event.data.object.metadata?.workflow === "appointment_booking") {
        await confirmAppointmentFromStripeSession(event.data.object);
      } else {
        await markPaymentPaid(event.data.object.id, event.data.object.payment_intent || null);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Erreur webhook Stripe:", error);
    return NextResponse.json({ message: "Webhook Stripe non traité." }, { status: 500 });
  }
}
