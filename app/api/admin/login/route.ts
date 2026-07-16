import { NextResponse } from "next/server";
import { getAdminConfigurationError, ownerIdentity, setAdminSession, verifyAdminPassword } from "@/lib/admin-auth";
import { checkRateLimit, requestIp } from "@/lib/rate-limit";
import { authenticateStaffMember, createAuditLog } from "@/lib/platform-v2";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const rate = checkRateLimit(`admin-login:${requestIp(request)}`, 8, 15 * 60 * 1000);
    if (!rate.allowed) return NextResponse.json({ message: "Trop de tentatives. Réessayez dans quelques minutes." }, { status: 429, headers: { "Retry-After": String(rate.retryAfter) } });
    const configurationError = getAdminConfigurationError();
    if (configurationError) {
      console.error("[admin-login]", configurationError);
      return NextResponse.json(
        { message: "Connexion indisponible: configuration administrateur manquante sur Vercel." },
        { status: 503 },
      );
    }

    const body = (await request.json()) as { email?:string; password?: string };
    const email=String(body.email||"").trim().toLowerCase();
    const identity=email?await authenticateStaffMember(email,String(body.password||"")):verifyAdminPassword(String(body.password||""))?ownerIdentity:null;
    if (!identity) {
      console.warn("[admin-login] Mot de passe administrateur refusé.");
      return NextResponse.json({ message: "Mot de passe administrateur incorrect." }, { status: 401 });
    }

    console.info("[admin-login] Connexion administrateur réussie.");
    await createAuditLog({ actorId:identity.id, action:"login", entityType:"admin_session", summary:`Connexion réussie · ${identity.name}`, ipAddress:requestIp(request), userAgent:request.headers.get("user-agent")||undefined }).catch((error)=>console.error("[audit] connexion",error));
    return setAdminSession(NextResponse.json({ message: "Connexion réussie." }),identity);
  } catch (error) {
    console.error("[admin-login] Erreur inattendue:", error);
    return NextResponse.json({ message: "Connexion impossible en raison d'une erreur serveur." }, { status: 500 });
  }
}
