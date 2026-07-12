import { NextResponse } from "next/server";
import { confirmAppointmentFromStripeSession } from "@/lib/booking";
import { markPaymentPaid, verifyStripeWebhookSignature } from "@/lib/production-workflow";

export const runtime = "nodejs";
export const maxDuration = 60;

function logWebhook(stage: string, details: Record<string, unknown> = {}) {
  console.info("[stripe-webhook]", JSON.stringify({ stage, ...details }));
}

export async function POST(request: Request) {
  try {
    // Stripe exige le corps brut exact. Ne pas appeler request.json() avant la validation.
    const rawBody = await request.text();
    const signature = request.headers.get("stripe-signature");
    logWebhook("received", { rawBodyBytes: Buffer.byteLength(rawBody), hasSignature: Boolean(signature) });

    if (!(await verifyStripeWebhookSignature(rawBody, signature))) {
      console.error("[stripe-webhook]", JSON.stringify({ stage: "signature_invalid", hasSignature: Boolean(signature) }));
      return NextResponse.json({ received: false, stage: "signature", message: "Signature Stripe invalide." }, { status: 400 });
    }

    const event = JSON.parse(rawBody) as {
      id?: string;
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

    const sessionId = event.data?.object?.id || null;
    logWebhook("signature_valid", { eventId: event.id, eventType: event.type, sessionId });

    if (event.type === "checkout.session.completed" && event.data?.object?.id) {
      if (event.data.object.metadata?.workflow === "appointment_booking") {
        logWebhook("appointment_start", { eventId: event.id, sessionId });
        const appointment = await confirmAppointmentFromStripeSession(event.data.object);
        logWebhook("appointment_complete", {
          eventId: event.id,
          sessionId,
          appointmentId: appointment?.id,
          bookingReference: appointment?.booking_reference,
          invoiceNumber: appointment?.invoice_number,
        });
      } else {
        logWebhook("client_payment_start", { eventId: event.id, sessionId });
        await markPaymentPaid(event.data.object.id, event.data.object.payment_intent || null);
        logWebhook("client_payment_complete", { eventId: event.id, sessionId });
      }
    } else {
      logWebhook("ignored", { eventId: event.id, eventType: event.type, sessionId });
    }

    return NextResponse.json({ received: true, eventId: event.id, sessionId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    console.error("[stripe-webhook]", JSON.stringify({
      stage: "failed",
      message,
      stack: error instanceof Error ? error.stack : undefined,
    }));
    return NextResponse.json(
      { received: false, stage: "processing", message: "Webhook Stripe non traité.", details: message },
      { status: 500 },
    );
  }
}
