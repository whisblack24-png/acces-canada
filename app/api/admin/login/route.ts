import { NextResponse } from "next/server";
import { getAdminConfigurationError, setAdminSession, verifyAdminPassword } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const configurationError = getAdminConfigurationError();
    if (configurationError) {
      console.error("[admin-login]", configurationError);
      return NextResponse.json(
        { message: "Connexion indisponible: configuration administrateur manquante sur Vercel." },
        { status: 503 },
      );
    }

    const body = (await request.json()) as { password?: string };
    if (!verifyAdminPassword(String(body.password || ""))) {
      console.warn("[admin-login] Mot de passe administrateur refusé.");
      return NextResponse.json({ message: "Mot de passe administrateur incorrect." }, { status: 401 });
    }

    console.info("[admin-login] Connexion administrateur réussie.");
    return setAdminSession(NextResponse.json({ message: "Connexion réussie." }));
  } catch (error) {
    console.error("[admin-login] Erreur inattendue:", error);
    return NextResponse.json({ message: "Connexion impossible en raison d'une erreur serveur." }, { status: 500 });
  }
}
