import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { downloadClientFile } from "@/lib/client-portal";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: Context) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "Non autorise." }, { status: 401 });
  }

  const { id } = await context.params;
  const clientId = _request.url.includes("clientId=") ? new URL(_request.url).searchParams.get("clientId") : null;

  if (!clientId) {
    return NextResponse.json({ message: "clientId requis." }, { status: 400 });
  }

  const result = await downloadClientFile(clientId, id).catch((error) => {
    console.error("Erreur telechargement admin upload:", error);
    return null;
  });

  if (!result) return NextResponse.json({ message: "Document introuvable." }, { status: 404 });

  return new Response(result.bytes, {
    headers: {
      "Content-Type": result.record.file_type || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${result.record.file_name}"`,
      "Cache-Control": "no-store",
    },
  });
}
