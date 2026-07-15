import { NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { downloadClientFile } from "@/lib/client-portal";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: Context) {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ message: "Non autorisé." }, { status: 401 });

  const { id } = await context.params;
  const result = await downloadClientFile(session.clientId, id).catch((error) => {
    console.error("Erreur telechargement upload client:", error);
    return null;
  });
  if (!result) return NextResponse.json({ message: "Document introuvable." }, { status: 404 });

  return new Response(new Uint8Array(result.bytes), {
    headers: {
      "Content-Type": result.record.file_type || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${result.record.file_name}"`,
      "Cache-Control": "no-store",
    },
  });
}
