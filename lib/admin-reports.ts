import type { AdminClient, ClientStatus, ServiceType } from "@/lib/admin-data";
import { dashboardStats, dossierStatuses, serviceLabels, serviceTypes, statusLabels } from "@/lib/admin-data";
import { listGeneratedDocuments, type GeneratedDocument } from "@/lib/admin-documents";
import { listAllClientUploads, type ClientUploadedDocument } from "@/lib/client-portal";
import { brand } from "@/lib/site";

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
  return date.toLocaleDateString("fr-CA", { month: "short", year: "numeric" });
}

function money(value: number) {
  return `${Number(value || 0).toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
}

function safePdf(value: string | number | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
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
      completedCases: clients.filter((client) => client.status === "termine").length,
      refusedCases: clients.filter((client) => client.status === "refuse").length,
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
  const generatedDate = new Date(report.generatedAt).toLocaleDateString("fr-CA");
  let y = 760;

  content.push("q 0.043 0.114 0.212 rg 0 720 612 72 re f Q\n");
  content.push("q 0.831 0.686 0.216 rg 36 706 540 3 re f Q\n");
  line(content, brand.name.toUpperCase(), 36, 756, 21, true, "1 1 1");
  line(content, brand.slogan, 36, 738, 9, false, "1 1 1");
  line(content, "Rapport administratif", 36, 682, 22, true);
  line(content, `Genere le ${generatedDate}`, 36, 662, 10, false, "0.2 0.2 0.2");
  y = 625;

  section(content, "Synthese", y);
  y -= 30;
  const cards = [
    ["Clients", report.totals.clients],
    ["Dossiers actifs", report.totals.activeCases],
    ["Documents generes", report.totals.generatedDocuments],
    ["Documents envoyes", report.totals.uploadedDocuments],
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
  section(content, "Repartition des dossiers", y);
  y -= 28;
  report.byStatus.forEach((row) => {
    line(content, row.label, 48, y, 9, false, "0.12 0.12 0.12");
    line(content, String(row.value), 250, y, 9, true);
    y -= 18;
  });

  y -= 12;
  section(content, "Services demandes", y);
  y -= 28;
  report.byService.forEach((row) => {
    line(content, row.label, 48, y, 9, false, "0.12 0.12 0.12");
    line(content, String(row.value), 250, y, 9, true);
    y -= 18;
  });

  y -= 12;
  section(content, "Documents", y);
  y -= 28;
  const documentRows = report.documentsByType.length ? report.documentsByType : [{ label: "Aucun document genere", value: 0 }];
  documentRows.slice(0, 8).forEach((row) => {
    line(content, row.label, 48, y, 9, false, "0.12 0.12 0.12");
    line(content, String(row.value), 340, y, 9, true);
    y -= 18;
  });

  y -= 10;
  section(content, "Dossiers recents", y);
  y -= 28;
  report.recentClients.slice(0, 7).forEach((client) => {
    const service = serviceLabels[client.service as ServiceType] || client.service;
    const status = statusLabels[client.status as ClientStatus] || client.status;
    line(content, `${client.full_name} - ${service}`, 48, y, 8.5, false, "0.12 0.12 0.12");
    line(content, status, 430, y, 8.5, true);
    y -= 16;
  });

  content.push("q 0.8 0.063 0.18 rg 36 45 540 1 re f Q\n");
  line(content, `${brand.phone}  |  ${brand.email}`, 36, 30, 8, false, "0.3 0.3 0.3");

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
  writeObject(parts, 4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", offsets);
  writeObject(parts, 5, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>", offsets);
  writeObject(parts, 6, `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`, offsets);

  const xref = parts.join("").length;
  parts.push("xref\n0 7\n0000000000 65535 f \n");
  for (let index = 1; index <= 6; index += 1) {
    parts.push(`${String(offsets[index]).padStart(10, "0")} 00000 n \n`);
  }
  parts.push(`trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);

  return Buffer.from(parts.join(""), "latin1");
}
