import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { listClients } from "@/lib/admin-data";
import { buildAdminReport, generateAdminReportExcel, generateAdminReportPdf } from "@/lib/admin-reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }

  try {
    const format = new URL(request.url).searchParams.get("format") || "pdf";
    const clients = await listClients();
    const report = await buildAdminReport(clients);
    const fileDate = new Date().toISOString().slice(0, 10);

    if (format === "excel") {
      const workbook = generateAdminReportExcel(report);

      return new Response(workbook, {
        headers: {
          "Content-Type": "application/vnd.ms-excel; charset=utf-8",
          "Content-Disposition": `attachment; filename="rapport-acces-canada-${fileDate}.xls"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const pdf = generateAdminReportPdf(report);

    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="rapport-acces-canada-${fileDate}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Erreur export rapport:", error);
    return NextResponse.json({ message: "Impossible de générer le rapport." }, { status: 500 });
  }
}
