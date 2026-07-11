import { NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { listGeneratedDocumentsForClient } from "@/lib/admin-documents";

export const runtime = "nodejs";

export async function GET() {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ message: "Non autorisé." }, { status: 401 });

  try {
    return NextResponse.json({ documents: await listGeneratedDocumentsForClient(session.clientId) });
  } catch (error) {
    console.error("Erreur documents générés client:", error);
    return NextResponse.json({ message: "Impossible de charger les documents." }, { status: 500 });
  }
}
