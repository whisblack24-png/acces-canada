import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { listClients } from "@/lib/admin-data";
import { buildAdminReport, generateAdminReportPdf } from "@/lib/admin-reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "Non autorise." }, { status: 401 });
  }

  try {
    const clients = await listClients();
    const report = await buildAdminReport(clients);
    const pdf = generateAdminReportPdf(report);
    const fileDate = new Date().toISOString().slice(0, 10);

    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="rapport-acces-canada-${fileDate}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Erreur export rapport:", error);
    return NextResponse.json({ message: "Impossible de generer le rapport PDF." }, { status: 500 });
  }
}
