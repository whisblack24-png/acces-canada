import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { downloadClientFile } from "@/lib/client-portal";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: Context) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }

  const { id } = await context.params;
  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId");
  const disposition = url.searchParams.get("disposition") === "inline" ? "inline" : "attachment";

  if (!clientId) {
    return NextResponse.json({ message: "clientId requis." }, { status: 400 });
  }

  const result = await downloadClientFile(clientId, id).catch((error) => {
    console.error("Erreur telechargement admin upload:", error);
    return null;
  });

  if (!result) return NextResponse.json({ message: "Document introuvable." }, { status: 404 });

  return new Response(new Uint8Array(result.bytes), {
    headers: {
      "Content-Type": result.record.file_type || "application/octet-stream",
      "Content-Disposition": `${disposition}; filename="${result.record.file_name.replace(/["\r\n]/g, "-")}"`,
      "Cache-Control": "no-store",
    },
  });
}
