import { NextResponse } from "next/server";
import { setClientSession } from "@/lib/client-auth";
import { verifyLoginCode } from "@/lib/client-portal";
import { checkRateLimit, requestIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const rate = checkRateLimit(`client-verify:${requestIp(request)}`, 10, 15 * 60 * 1000);
    if (!rate.allowed) return NextResponse.json({ message: "Trop de tentatives. Demandez un nouveau code plus tard." }, { status: 429, headers: { "Retry-After": String(rate.retryAfter) } });
    const { email, code } = (await request.json()) as { email?: string; code?: string };
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanCode = String(code || "").trim();

    if (!cleanEmail || !cleanCode) {
      return NextResponse.json({ message: "Courriel et code requis." }, { status: 400 });
    }

    const session = await verifyLoginCode(cleanEmail, cleanCode);
    if (!session) {
      return NextResponse.json({ message: "Code invalide ou expiré." }, { status: 401 });
    }

    return setClientSession(NextResponse.json({ message: "Connexion reussie." }), session.clientId, session.email);
  } catch (error) {
    console.error("Erreur vérification code client:", error);
    return NextResponse.json({ message: "Impossible de verifier le code." }, { status: 500 });
  }
}
