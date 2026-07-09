import { NextResponse } from "next/server";
import { setClientSession } from "@/lib/client-auth";
import { verifyLoginCode } from "@/lib/client-portal";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { email, code } = (await request.json()) as { email?: string; code?: string };
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanCode = String(code || "").trim();

    if (!cleanEmail || !cleanCode) {
      return NextResponse.json({ message: "Courriel et code requis." }, { status: 400 });
    }

    const session = await verifyLoginCode(cleanEmail, cleanCode);
    if (!session) {
      return NextResponse.json({ message: "Code invalide ou expire." }, { status: 401 });
    }

    return setClientSession(NextResponse.json({ message: "Connexion reussie." }), session.clientId, session.email);
  } catch (error) {
    console.error("Erreur verification code client:", error);
    return NextResponse.json({ message: "Impossible de verifier le code." }, { status: 500 });
  }
}
