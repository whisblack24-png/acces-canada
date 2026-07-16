import type { AdminClient, ServiceType } from "@/lib/admin-data";
import { serviceLabels, statusLabels } from "@/lib/admin-data";
import { formatDateFr, formatMoney } from "@/lib/format";
import type { QuestionnaireAnswers } from "@/lib/questionnaires";

export type QuestionnaireDocumentData = { client?: QuestionnaireAnswers; guarantor?: QuestionnaireAnswers };

export type ClientDocumentType =
  | "convention"
  | "reconnaissance-dette"
  | "checklist-visa"
  | "facture"
  | "lettre-explicative"
  | "lettre-soutien-financier"
  | "lettre-invitation"
  | "recu-paiement";

export type DocumentGenerationOptions = {
  includePersonalInfo?: boolean;
  includeContactInfo?: boolean;
  includeServiceInfo?: boolean;
  includeDocuments?: boolean;
  includeNotes?: boolean;
  includePayments?: boolean;
  includeSignatures?: boolean;
};

export const documentLabels: Record<ClientDocumentType, string> = {
  convention: "Convention de services",
  "reconnaissance-dette": "Reconnaissance de dette",
  "checklist-visa": "Liste de vérification visa visiteur",
  facture: "Facture client",
  "lettre-explicative": "Lettre explicative",
  "lettre-soutien-financier": "Lettre de soutien financier",
  "lettre-invitation": "Lettre d'invitation",
  "recu-paiement": "Reçu de paiement",
};

export const documentLibrary: { type: ClientDocumentType; label: string; description: string }[] = [
  { type: "convention", label: documentLabels.convention, description: "Cadre professionnel de prestation et responsabilités." },
  { type: "facture", label: documentLabels.facture, description: "Facturation client avec montant, taxes et statut." },
  { type: "recu-paiement", label: documentLabels["recu-paiement"], description: "Preuve de paiement professionnelle pour le client." },
  { type: "reconnaissance-dette", label: documentLabels["reconnaissance-dette"], description: "Modalités de paiement et engagement financier." },
  { type: "checklist-visa", label: documentLabels["checklist-visa"], description: "Documents reçus, manquants et suivi du dossier visa visiteur." },
  { type: "lettre-explicative", label: documentLabels["lettre-explicative"], description: "Lettre explicative IRCC simple pour clarifier le projet du demandeur." },
  {
    type: "lettre-soutien-financier",
    label: documentLabels["lettre-soutien-financier"],
    description: "Modèle de soutien financier adapté au dossier client.",
  },
  { type: "lettre-invitation", label: documentLabels["lettre-invitation"], description: "Lettre d'invitation pour visite temporaire au Canada." },
];

function safe(value: string | number | null | undefined) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function dateFr(value?: string | null) {
  return formatDateFr(value || new Date());
}

function money(value: number | null | undefined) {
  return formatMoney(value);
}

function baseInfo(client: AdminClient, options: DocumentGenerationOptions = {}) {
  const include = {
    includePersonalInfo: true,
    includeContactInfo: true,
    includeServiceInfo: true,
    ...options,
  };
  const rows: [string, string][] = [];

  if (include.includePersonalInfo) {
    rows.push(
      ["Nom complet du client", client.full_name],
      ["Référence dossier", client.file_reference || "Référence à créer"],
      ["Pays", client.country || "Non renseigné"],
    );
  }

  if (include.includeContactInfo) {
    rows.push(["Courriel", client.email], ["Téléphone", client.phone || "Non renseigné"]);
  }

  if (include.includeServiceInfo) {
    rows.push(
      ["Service", serviceLabels[client.service as ServiceType] || client.service],
      ["Statut", statusLabels[client.status] || client.status],
      ["Date de création", dateFr(client.created_at)],
    );
  }

  return rows;
}

function notesRows(client: AdminClient, options: DocumentGenerationOptions) {
  return options.includeNotes
    ? ([["section", "Notes internes"], ["Texte", client.internal_notes || client.notes || "Aucune note particulière."]] as [string, string][])
    : [];
}

function signatureRows(options: DocumentGenerationOptions) {
  return options.includeSignatures === false
    ? []
    : ([
        ["section", "Signatures"],
        ["Client", "Signature: ____________________________   Date: ____________"],
        ["Accès Canada", "Christian Nkuli Mboyo, Directeur général - Accès Canada"],
        ["Signature", "Signature: ____________________________   Date: ____________"],
      ] as [string, string][]);
}

function answer(data: QuestionnaireAnswers | undefined, key: string, fallback = "Non renseigné") {
  const value = data?.[key];
  return value === true ? "Oui" : value === false ? "Non" : String(value || "").trim() || fallback;
}

function linesFor(client: AdminClient, type: ClientDocumentType, options: DocumentGenerationOptions = {}, questionnaireData: QuestionnaireDocumentData = {}) {
  const settings: DocumentGenerationOptions = {
    includePersonalInfo: true,
    includeContactInfo: true,
    includeServiceInfo: true,
    includeDocuments: true,
    includeNotes: true,
    includePayments: true,
    includeSignatures: true,
    ...options,
  };
  const issued = dateFr(new Date().toISOString());
  const received = client.documents_received?.length ? client.documents_received : ["Aucun document marqué comme reçu"];
  const missing = client.documents_missing?.length ? client.documents_missing : ["Aucun document marqué comme manquant"];
  const principal = questionnaireData.client;
  const guarantor = questionnaireData.guarantor;

  if (type === "convention") {
    return [
      ["section", "Informations du dossier"],
      ...baseInfo(client, settings),
      ["section", "Objet de la convention"],
      [
        "Texte",
        `Accès Canada accompagne ${client.full_name} dans la préparation de sa demande de ${serviceLabels[client.service as ServiceType] || client.service}. Objet déclaré : ${answer(principal, "travel_purpose", "préparation administrative du dossier d'immigration")}. Les décisions finales relèvent exclusivement des autorités canadiennes.`,
      ],
      ["Dates prévues", `${answer(principal, "arrival_date")} au ${answer(principal, "departure_date")}`],
      ["Financement", answer(principal, "funding_source")],
      ["section", "Engagements"],
      ["Texte", "Le client s'engage à fournir des renseignements exacts, complets et vérifiables."],
      ["Texte", "Accès Canada assure un suivi professionnel, confidentiel et conforme aux informations communiquées."],
      ...notesRows(client, settings),
      ...signatureRows(settings),
    ];
  }

  if (type === "reconnaissance-dette") {
    return [
      ["section", "Informations du client"],
      ...baseInfo(client, settings),
      ...(settings.includePayments ? ([["Montant déjà payé", money(client.paid_amount)]] as [string, string][]) : []),
      ["section", "Modalités de paiement"],
      ["Texte", "Le client reconnaît devoir les montants restant dus selon les conditions convenues avec Accès Canada."],
      ["Texte", "Tout retard de paiement peut suspendre le traitement administratif du dossier jusqu'à régularisation."],
      ["section", "Tableau des paiements"],
      ["Paiement 1", "Date: ____________   Montant: ____________   Mode: ____________"],
      ["Paiement 2", "Date: ____________   Montant: ____________   Mode: ____________"],
      ["Paiement 3", "Date: ____________   Montant: ____________   Mode: ____________"],
      ...signatureRows(settings),
    ];
  }

  if (type === "checklist-visa") {
    return [
      ["section", "Informations du dossier"],
      ...baseInfo(client, settings),
      ...(settings.includeDocuments
        ? ([
            ["section", "Documents reçus"],
            ...received.map((item) => ["[x]", item] as [string, string]),
            ["section", "Documents manquants"],
            ...missing.map((item) => ["[ ]", item] as [string, string]),
          ] as [string, string][])
        : []),
      ["section", "Suivi"],
      ["Texte", "Cette liste est mise à jour selon les documents transmis par le client et les exigences du type de demande."],
      ...notesRows(client, settings),
    ];
  }

  if (type === "lettre-explicative") {
    return [
      ["section", "Objet"],
      ["Texte", "Cette lettre vise à présenter clairement le contexte, le projet et les éléments administratifs du dossier."],
      ["section", "Informations du demandeur"],
      ...baseInfo(client, settings),
      ["section", "Déclaration"],
      [
        "Texte",
        "Le demandeur souhaite soumettre un dossier complet, cohérent et conforme aux exigences applicables. Les informations fournies devront être accompagnées des pièces justificatives pertinentes.",
      ],
      ["Motif du voyage", answer(principal, "travel_purpose")],
      ["Itinéraire", answer(principal, "itinerary", answer(principal, "cities"))],
      ["Hébergement", answer(principal, "accommodation_details")],
      ["Attaches et retour", answer(principal, "return_reasons")],
      ...notesRows(client, settings),
      ...signatureRows(settings),
    ];
  }

  if (type === "lettre-soutien-financier") {
    return [
      ["section", "Objet"],
      ["Texte", "Cette lettre confirme l'intention de soutien financier dans le cadre du projet d'immigration ou de séjour au Canada."],
      ["section", "Bénéficiaire"],
      ...baseInfo(client, settings),
      ["section", "Engagement"],
      [
        "Texte",
        "Le signataire confirme être disposé à soutenir financièrement le bénéficiaire selon les besoins du dossier et les justificatifs présentés.",
      ],
      ["Garant", `${answer(guarantor, "given_names")} ${answer(guarantor, "family_name")}`],
      ["Lien avec le client", answer(guarantor, "relationship")],
      ["Dépenses couvertes", answer(guarantor, "covered_expenses")],
      ["Contribution maximale", `${answer(guarantor, "maximum_contribution")} ${answer(guarantor, "contribution_currency", "")}`.trim()],
      ["Motif du soutien", answer(guarantor, "support_reason")],
      ...signatureRows(settings),
    ];
  }

  if (type === "lettre-invitation") {
    return [
      ["section", "Objet"],
      ["Texte", "Cette lettre est préparée pour soutenir une invitation temporaire au Canada, sous réserve des renseignements fournis."],
      ["section", "Personne invitée"],
      ...baseInfo(client, settings),
      ["section", "Contexte de l'invitation"],
      [
        "Texte",
        "L'invitation devra préciser le lien avec l'hôte, la durée prévue du séjour, l'adresse d'accueil et les responsabilités pendant le séjour.",
      ],
      ["Durée du séjour", `${answer(principal, "arrival_date")} au ${answer(principal, "departure_date")}`],
      ["Villes visitées", answer(principal, "cities")],
      ["Adresse d'accueil", answer(principal, "accommodation_details")],
      ...signatureRows(settings),
    ];
  }

  if (type === "recu-paiement") {
    return [
      ["Reçu", `RECU-${client.id.slice(0, 8).toUpperCase()}`],
      ["Date", issued],
      ["section", "Client"],
      ...baseInfo(client, settings),
      ["section", "Paiement"],
      ["Montant reçu", money(client.paid_amount)],
      ["Mode de paiement", "À confirmer"],
      ["Description", serviceLabels[client.service as ServiceType] || client.service],
      ["section", "Confirmation"],
      ["Texte", "Accès Canada confirme la réception du paiement indiqué pour le dossier mentionné ci-dessus."],
    ];
  }

  const subtotal = Number(client.paid_amount || 0);
  return [
    ["Facture", `FACT-${client.id.slice(0, 8).toUpperCase()}`],
    ["Date d'émission", issued],
    ["Statut", subtotal > 0 ? "Payée / acompte reçu" : "En attente"],
    ["section", "Client"],
    ...baseInfo(client, settings),
    ["section", "Services"],
    [serviceLabels[client.service as ServiceType] || client.service, money(subtotal)],
    ["Sous-total", money(subtotal)],
    ["Taxes", "À compléter"],
    ["Total à payer", money(subtotal)],
    ["section", "Mode de paiement"],
    ["Texte", "À compléter ultérieurement par Accès Canada."],
    ["section", "Remarques"],
    ...(settings.includeNotes ? ([["Texte", client.internal_notes || client.notes || "Merci pour votre confiance."]] as [string, string][]) : []),
  ];
}

function writeObject(parts: string[], index: number, body: string, offsets: number[]) {
  offsets[index] = parts.join("").length;
  parts.push(`${index} 0 obj\n${body}\nendobj\n`);
}

export function generateClientPdf(client: AdminClient, type: ClientDocumentType, options: DocumentGenerationOptions = {}, questionnaireData: QuestionnaireDocumentData = {}) {
  const title = documentLabels[type];
  const rows = linesFor(client, type, options, questionnaireData);
  const content: string[] = [];
  let y = 760;

  content.push("q 0.98 0.965 0.925 rg 0 0 612 792 re f Q\n");
  content.push("q 0.043 0.114 0.212 rg 0 720 612 72 re f Q\n");
  content.push("q 0.831 0.686 0.216 rg 36 706 540 3 re f Q\n");
  content.push("q 0.831 0.686 0.216 rg 36 734 46 46 re f Q\n");
  content.push("q 0.8 0.063 0.18 rg 42 740 34 34 re f Q\n");
  content.push("BT /F2 16 Tf 1 1 1 rg 48 752 Td (AC) Tj ET\n");
  content.push("BT /F2 21 Tf 1 1 1 rg 96 756 Td (ACCÈS CANADA) Tj ET\n");
  content.push("BT /F1 9 Tf 1 1 1 rg 96 738 Td (Votre chemin vers le Canada, notre engagement.) Tj ET\n");
  content.push("BT /F1 8 Tf 1 1 1 rg 390 756 Td (+1 819-266-8420) Tj ET\n");
  content.push("BT /F1 8 Tf 1 1 1 rg 390 742 Td (accesc625@gmail.com) Tj ET\n");
  content.push(`BT /F2 19 Tf 0.043 0.114 0.212 rg 36 682 Td (${safe(title)}) Tj ET\n`);
  content.push(`BT /F1 10 Tf 0.2 0.2 0.2 rg 36 664 Td (${safe(`Généré le ${dateFr(new Date().toISOString())}`)}) Tj ET\n`);
  content.push(`BT /F2 10 Tf 0.8 0.063 0.18 rg 390 664 Td (${safe(client.file_reference || "Référence à créer")}) Tj ET\n`);
  y = 628;

  rows.forEach(([label, value]) => {
    if (label === "section") {
      y -= 12;
      content.push(`q 0.831 0.686 0.216 rg 36 ${y + 11} 180 1.5 re f Q\n`);
      content.push(`BT /F2 13 Tf 0.043 0.114 0.212 rg 36 ${y} Td (${safe(value)}) Tj ET\n`);
      y -= 28;
      return;
    }

    const wrapped = safe(value).match(/.{1,74}(\s|$)|.{1,74}/g) || [safe(value)];
    content.push(`q 1 1 1 rg 36 ${y - Math.max(14, wrapped.length * 13) - 8} 540 ${Math.max(24, wrapped.length * 13 + 11)} re f Q\n`);
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
  writeObject(parts, 4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>", offsets);
  writeObject(parts, 5, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>", offsets);
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
