import { NextResponse } from "next/server";
import { consultationTypes, listAvailableSlots, type ConsultationType } from "@/lib/booking";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const consultationType = (searchParams.get("type") || "consultation_30") as ConsultationType;

  if (!consultationTypes[consultationType]) {
    return NextResponse.json({ message: "Type de consultation invalide." }, { status: 400 });
  }

  try {
    return NextResponse.json({ slots: await listAvailableSlots(consultationType) });
  } catch (error) {
    console.error("Erreur créneaux:", error);
    return NextResponse.json({ message: "Impossible de charger les créneaux disponibles." }, { status: 500 });
  }
}
