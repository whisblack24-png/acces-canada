import type { AdminClient, ClientStatus, ServiceType } from "@/lib/admin-data";
import { dashboardStats, dossierStatuses, serviceLabels, serviceTypes, statusLabels } from "@/lib/admin-data";
import { listGeneratedDocuments, type GeneratedDocument } from "@/lib/admin-documents";
import { listAllClientUploads, type ClientUploadedDocument } from "@/lib/client-portal";
import { brand } from "@/lib/site";
import { formatDateFr, formatUsd } from "@/lib/format";
import { officialSealCommands, premiumFooterCommands, qrCodeCommands, verificationUrl, watermarkCommands } from "@/lib/document-branding";

export type ReportRow = {
  label: string;
  value: number;
};

export type AdminReport = {
  generatedAt: string;
  clients: AdminClient[];
  generatedDocuments: GeneratedDocument[];
  uploadedDocuments: ClientUploadedDocument[];
  totals: {
    clients: number;
    activeCases: number;
    completedCases: number;
    refusedCases: number;
    pendingPayments: number;
    generatedDocuments: number;
    uploadedDocuments: number;
    payments: number;
    revenue: number;
    documentsReceived: number;
    documentsMissing: number;
  };
  byStatus: ReportRow[];
  byService: ReportRow[];
  documentsByType: ReportRow[];
  monthlyClients: ReportRow[];
  recentClients: AdminClient[];
};

function countBy<T extends string>(items: T[]) {
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item] = (acc[item] || 0) + 1;
    return acc;
  }, {});
}

function monthLabel(dateValue: string) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "Date inconnue";
  return date.toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
}

function money(value: number) {
  return formatUsd(value);
}

function safePdf(value: string | number | null | undefined) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function writeObject(parts: string[], index: number, body: string, offsets: number[]) {
  offsets[index] = parts.join("").length;
  parts.push(`${index} 0 obj\n${body}\nendobj\n`);
}

function line(content: string[], text: string, x: number, y: number, size = 10, bold = false, color = "0.043 0.114 0.212") {
  content.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${color} rg ${x} ${y} Td (${safePdf(text)}) Tj ET\n`);
}

function section(content: string[], title: string, y: number) {
  content.push(`q 0.831 0.686 0.216 rg 36 ${y + 14} 150 1.6 re f Q\n`);
  line(content, title, 36, y, 13, true);
}

export async function buildAdminReport(clients: AdminClient[]): Promise<AdminReport> {
  const [generatedDocuments, uploadedDocuments] = await Promise.all([
    listGeneratedDocuments().catch(() => []),
    listAllClientUploads().catch(() => []),
  ]);

  const stats = dashboardStats(clients);
  const statusCounts = countBy(clients.map((client) => client.status));
  const serviceCounts = countBy(clients.map((client) => client.service));
  const documentCounts = countBy(generatedDocuments.map((document) => document.document_label || document.document_type));
  const monthlyCounts = countBy(clients.map((client) => monthLabel(client.created_at)));

  return {
    generatedAt: new Date().toISOString(),
    clients,
    generatedDocuments,
    uploadedDocuments,
    totals: {
      clients: stats.clients,
      activeCases: stats.active,
      completedCases: stats.completed,
      refusedCases: stats.refused,
      pendingPayments: stats.pendingPayments,
      generatedDocuments: generatedDocuments.length,
      uploadedDocuments: uploadedDocuments.length,
      payments: stats.payments,
      revenue: stats.revenue,
      documentsReceived: clients.reduce((total, client) => total + (client.documents_received?.length || 0), 0),
      documentsMissing: clients.reduce((total, client) => total + (client.documents_missing?.length || 0), 0),
    },
    byStatus: dossierStatuses.map((status) => ({ label: statusLabels[status], value: statusCounts[status] || 0 })),
    byService: serviceTypes.map((service) => ({
      label: serviceLabels[service as ServiceType] || service,
      value: serviceCounts[service] || 0,
    })),
    documentsByType: Object.entries(documentCounts)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value),
    monthlyClients: Object.entries(monthlyCounts).map(([label, value]) => ({ label, value })).slice(-8),
    recentClients: [...clients].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, 8),
  };
}

export function generateAdminReportPdf(report: AdminReport) {
  const content: string[] = [];
  const generatedDate = formatDateFr(report.generatedAt);
  let y = 760;

  content.push(watermarkCommands());
  content.push("q 0.043 0.114 0.212 rg 0 720 612 72 re f Q\n");
  content.push("q 0.831 0.686 0.216 rg 36 706 540 3 re f Q\n");
  line(content, brand.name.toUpperCase(), 36, 756, 21, true, "1 1 1");
  line(content, brand.slogan, 36, 738, 9, false, "1 1 1");
  line(content, "Rapport administratif", 36, 682, 22, true);
  line(content, `Généré le ${generatedDate}`, 36, 662, 10, false, "0.2 0.2 0.2");
  y = 625;

  section(content, "Synthèse", y);
  y -= 30;
  const cards = [
    ["Clients", report.totals.clients],
    ["Dossiers actifs", report.totals.activeCases],
    ["Dossiers terminés", report.totals.completedCases],
    ["Paiements en attente", report.totals.pendingPayments],
    ["Documents générés", report.totals.generatedDocuments],
    ["Documents envoyés", report.totals.uploadedDocuments],
    ["Paiements", report.totals.payments],
    ["Revenus", money(report.totals.revenue)],
  ];
  cards.forEach(([label, value], index) => {
    const x = index % 2 === 0 ? 36 : 315;
    if (index % 2 === 0 && index > 0) y -= 38;
    line(content, String(label), x, y, 9, true);
    line(content, String(value), x + 125, y, 12, true, "0.8 0.063 0.18");
  });

  y -= 62;
  section(content, "Répartition des dossiers", y);
  y -= 28;
  report.byStatus.forEach((row) => {
    line(content, row.label, 48, y, 9, false, "0.12 0.12 0.12");
    line(content, String(row.value), 250, y, 9, true);
    y -= 18;
  });

  y -= 12;
  section(content, "Services demandés", y);
  y -= 28;
  report.byService.forEach((row) => {
    line(content, row.label, 48, y, 9, false, "0.12 0.12 0.12");
    line(content, String(row.value), 250, y, 9, true);
    y -= 18;
  });

  y -= 12;
  section(content, "Documents", y);
  y -= 28;
  const documentRows = report.documentsByType.length ? report.documentsByType : [{ label: "Aucun document généré", value: 0 }];
  documentRows.slice(0, 8).forEach((row) => {
    line(content, row.label, 48, y, 9, false, "0.12 0.12 0.12");
    line(content, String(row.value), 340, y, 9, true);
    y -= 18;
  });

  if (y > 145) {
    y -= 10;
    section(content, "Dossiers récents", y);
    y -= 28;
    report.recentClients.slice(0, 4).forEach((client) => {
      if (y < 64) return;
      const service = serviceLabels[client.service as ServiceType] || client.service;
      const status = statusLabels[client.status as ClientStatus] || client.status;
      line(content, `${client.full_name} - ${service}`, 48, y, 8.5, false, "0.12 0.12 0.12");
      line(content, status, 430, y, 8.5, true);
      y -= 16;
    });
  }

  content.push("q 0.8 0.063 0.18 rg 36 45 540 1 re f Q\n");
  line(content, `${brand.phone}  |  ${brand.email}`, 36, 30, 8, false, "0.3 0.3 0.3");
  const documentNumber=`AC-RPT-${report.generatedAt.slice(0,10).replace(/-/g,"")}`;
  content.push(officialSealCommands(470,72,86,false));
  content.push(premiumFooterCommands({documentNumber},1,1));
  content.push(qrCodeCommands(verificationUrl(),540,8,42));

  const stream = content.join("");
  const parts = ["%PDF-1.4\n"];
  const offsets = [0];
  writeObject(parts, 1, "<< /Type /Catalog /Pages 2 0 R >>", offsets);
  writeObject(parts, 2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", offsets);
  writeObject(
    parts,
    3,
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    offsets,
  );
  writeObject(parts, 4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>", offsets);
  writeObject(parts, 5, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>", offsets);
  writeObject(parts, 6, `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`, offsets);

  const xref = parts.join("").length;
  parts.push("xref\n0 7\n0000000000 65535 f \n");
  for (let index = 1; index <= 6; index += 1) {
    parts.push(`${String(offsets[index]).padStart(10, "0")} 00000 n \n`);
  }
  parts.push(`trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);

  return Buffer.from(parts.join(""), "latin1");
}

function xml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function worksheet(name: string, rows: (string | number)[][]) {
  return `<Worksheet ss:Name="${xml(name)}"><Table>${rows
    .map(
      (row) =>
        `<Row>${row
          .map((cell) => {
            const type = typeof cell === "number" ? "Number" : "String";
            return `<Cell><Data ss:Type="${type}">${xml(cell)}</Data></Cell>`;
          })
          .join("")}</Row>`,
    )
    .join("")}</Table></Worksheet>`;
}

export function generateAdminReportExcel(report: AdminReport) {
  const clientsRows: (string | number)[][] = [
    ["Référence", "Client", "Courriel", "Téléphone", "Pays", "Service", "Statut", "Montant payé", "Création"],
    ...report.clients.map((client) => [
      client.file_reference || "",
      client.full_name,
      client.email,
      client.phone || "",
      client.country || "",
      serviceLabels[client.service as ServiceType] || client.service,
      statusLabels[client.status as ClientStatus] || client.status,
      Number(client.paid_amount || 0),
      formatDateFr(client.created_at),
    ]),
  ];
  const casesRows: (string | number)[][] = [
    ["Statut", "Nombre"],
    ...report.byStatus.map((row) => [row.label, row.value]),
  ];
  const paymentsRows: (string | number)[][] = [
    ["Indicateur", "Valeur"],
    ["Paiements enregistrés", report.totals.payments],
    ["Paiements en attente", report.totals.pendingPayments],
    ["Revenus", report.totals.revenue],
  ];
  const performanceRows: (string | number)[][] = [
    ["Indicateur", "Valeur"],
    ["Clients", report.totals.clients],
    ["Dossiers actifs", report.totals.activeCases],
    ["Dossiers terminés", report.totals.completedCases],
    ["Dossiers refusés", report.totals.refusedCases],
    ["Documents générés", report.totals.generatedDocuments],
    ["Documents envoyés", report.totals.uploadedDocuments],
    ["Documents reçus", report.totals.documentsReceived],
    ["Documents manquants", report.totals.documentsMissing],
  ];

  const xmlWorkbook = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${worksheet("Clients", clientsRows)}
${worksheet("Dossiers", casesRows)}
${worksheet("Paiements", paymentsRows)}
${worksheet("Performances", performanceRows)}
</Workbook>`;

  return Buffer.from(xmlWorkbook, "utf8");
}
