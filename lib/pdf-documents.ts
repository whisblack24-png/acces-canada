import type { AdminClient, ServiceType } from "@/lib/admin-data";
import { serviceLabels, statusLabels } from "@/lib/admin-data";

export type ClientDocumentType = "convention" | "reconnaissance-dette" | "checklist-visa" | "facture";

const documentLabels: Record<ClientDocumentType, string> = {
  convention: "Convention de services",
  "reconnaissance-dette": "Reconnaissance de dette",
  "checklist-visa": "Liste de verification visa",
  facture: "Facture client",
};

function safe(value: string | number | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function dateFr(value?: string | null) {
  if (!value) return new Date().toLocaleDateString("fr-CA");
  return new Date(value).toLocaleDateString("fr-CA");
}

function money(value: number | null | undefined) {
  return `${Number(value || 0).toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
}

function baseInfo(client: AdminClient) {
  return [
    ["Client", client.full_name],
    ["Courriel", client.email],
    ["Telephone", client.phone || "Non renseigne"],
    ["Pays", client.country || "Non renseigne"],
    ["Service", serviceLabels[client.service as ServiceType] || client.service],
    ["Statut", statusLabels[client.status] || client.status],
    ["Reference dossier", client.file_reference || "A creer"],
  ];
}

function linesFor(client: AdminClient, type: ClientDocumentType) {
  const issued = dateFr(new Date().toISOString());
  const received = client.documents_received?.length ? client.documents_received : ["Aucun document marque comme recu"];
  const missing = client.documents_missing?.length ? client.documents_missing : ["Aucun document marque comme manquant"];

  if (type === "convention") {
    return [
      ["section", "Informations du dossier"],
      ...baseInfo(client),
      ["section", "Objet de la convention"],
      [
        "Texte",
        "Acces Canada accompagne le client dans la preparation administrative de son dossier. Les decisions finales relevent exclusivement des autorites canadiennes.",
      ],
      ["section", "Engagements"],
      ["Texte", "Le client s'engage a fournir des renseignements exacts, complets et verifiables."],
      ["Texte", "Acces Canada assure un suivi professionnel, confidentiel et conforme aux informations communiquees."],
      ["section", "Signatures"],
      ["Client", "Signature: ____________________________   Date: ____________"],
      ["Acces Canada", "Signature: ____________________________   Date: ____________"],
    ];
  }

  if (type === "reconnaissance-dette") {
    return [
      ["section", "Informations du client"],
      ...baseInfo(client),
      ["Montant deja paye", money(client.paid_amount)],
      ["section", "Modalites de paiement"],
      ["Texte", "Le client reconnait devoir les montants restant dus selon les conditions convenues avec Acces Canada."],
      ["Texte", "Tout retard de paiement peut suspendre le traitement administratif du dossier jusqu'a regularisation."],
      ["section", "Tableau des paiements"],
      ["Paiement 1", "Date: ____________   Montant: ____________   Mode: ____________"],
      ["Paiement 2", "Date: ____________   Montant: ____________   Mode: ____________"],
      ["Paiement 3", "Date: ____________   Montant: ____________   Mode: ____________"],
      ["section", "Signatures"],
      ["Client", "Signature: ____________________________   Date: ____________"],
      ["Acces Canada", "Signature: ____________________________   Date: ____________"],
    ];
  }

  if (type === "checklist-visa") {
    return [
      ["section", "Informations du dossier"],
      ...baseInfo(client),
      ["section", "Documents recus"],
      ...received.map((item) => ["[x]", item] as [string, string]),
      ["section", "Documents manquants"],
      ...missing.map((item) => ["[ ]", item] as [string, string]),
      ["section", "Suivi"],
      ["Texte", "Cette liste est mise a jour selon les documents transmis par le client et les exigences du type de demande."],
    ];
  }

  const subtotal = Number(client.paid_amount || 0);
  return [
    ["Facture", `FACT-${client.id.slice(0, 8).toUpperCase()}`],
    ["Date d'emission", issued],
    ["Statut", subtotal > 0 ? "Payee / acompte recu" : "En attente"],
    ["section", "Client"],
    ...baseInfo(client),
    ["section", "Services"],
    [serviceLabels[client.service as ServiceType] || client.service, money(subtotal)],
    ["Sous-total", money(subtotal)],
    ["Taxes", "A completer"],
    ["Total a payer", money(subtotal)],
    ["section", "Mode de paiement"],
    ["Texte", "A completer ulterieurement par Acces Canada."],
    ["section", "Remarques"],
    ["Texte", client.internal_notes || client.notes || "Merci pour votre confiance."],
  ];
}

function writeObject(parts: string[], index: number, body: string, offsets: number[]) {
  offsets[index] = parts.join("").length;
  parts.push(`${index} 0 obj\n${body}\nendobj\n`);
}

export function generateClientPdf(client: AdminClient, type: ClientDocumentType) {
  const title = documentLabels[type];
  const rows = linesFor(client, type);
  const content: string[] = [];
  let y = 760;

  content.push("q 0.043 0.114 0.212 rg 0 720 612 72 re f Q\n");
  content.push("q 0.831 0.686 0.216 rg 36 706 540 3 re f Q\n");
  content.push("BT /F2 21 Tf 1 1 1 rg 36 756 Td (ACCES CANADA) Tj ET\n");
  content.push("BT /F1 9 Tf 1 1 1 rg 36 738 Td (Votre chemin vers le Canada, notre engagement.) Tj ET\n");
  content.push(`BT /F2 18 Tf 0.043 0.114 0.212 rg 36 682 Td (${safe(title)}) Tj ET\n`);
  content.push(`BT /F1 10 Tf 0.2 0.2 0.2 rg 36 664 Td (Genere le ${safe(dateFr(new Date().toISOString()))}) Tj ET\n`);
  y = 628;

  rows.forEach(([label, value]) => {
    if (label === "section") {
      y -= 12;
      content.push(`q 0.831 0.686 0.216 rg 36 ${y + 11} 170 1.5 re f Q\n`);
      content.push(`BT /F2 13 Tf 0.043 0.114 0.212 rg 36 ${y} Td (${safe(value)}) Tj ET\n`);
      y -= 28;
      return;
    }

    const wrapped = safe(value).match(/.{1,74}(\s|$)|.{1,74}/g) || [safe(value)];
    content.push(`BT /F2 9 Tf 0.043 0.114 0.212 rg 36 ${y} Td (${safe(label)}) Tj ET\n`);
    wrapped.forEach((line, index) => {
      content.push(`BT /F1 10 Tf 0.12 0.12 0.12 rg 180 ${y - index * 13} Td (${line.trim()}) Tj ET\n`);
    });
    y -= Math.max(23, wrapped.length * 14 + 8);
  });

  content.push("q 0.8 0.063 0.18 rg 36 45 540 1 re f Q\n");
  content.push("BT /F1 8 Tf 0.3 0.3 0.3 rg 36 30 Td (+1 819-266-8420  |  accesc625@gmail.com) Tj ET\n");

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
  parts.push(`xref\n0 7\n0000000000 65535 f \n`);
  for (let index = 1; index <= 6; index += 1) {
    parts.push(`${String(offsets[index]).padStart(10, "0")} 00000 n \n`);
  }
  parts.push(`trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);

  return Buffer.from(parts.join(""), "latin1");
}

export function isClientDocumentType(type: string): type is ClientDocumentType {
  return type in documentLabels;
}

export function documentFileName(client: AdminClient, type: ClientDocumentType) {
  const name = safe(client.full_name).replace(/\s+/g, "-").toLowerCase() || "client";
  return `${type}-${name}.pdf`;
}
