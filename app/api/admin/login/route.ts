import { NextResponse } from "next/server";
import { setAdminSession, verifyAdminPassword } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as { password?: string };

  if (!verifyAdminPassword(String(body.password || ""))) {
    return NextResponse.json({ message: "Mot de passe administrateur invalide." }, { status: 401 });
  }

  return setAdminSession(NextResponse.json({ message: "Connexion réussie." }));
}
