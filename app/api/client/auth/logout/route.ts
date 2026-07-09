import { NextResponse } from "next/server";
import { clearClientSession } from "@/lib/client-auth";

export const runtime = "nodejs";

export async function POST() {
  return clearClientSession(NextResponse.json({ message: "Deconnexion reussie." }));
}
