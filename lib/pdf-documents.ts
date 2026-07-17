import type { AdminClient, ServiceType } from "@/lib/admin-data";
import { serviceLabels, statusLabels } from "@/lib/admin-data";
import { formatDateFr, formatUsd } from "@/lib/format";
import type { QuestionnaireAnswers } from "@/lib/questionnaires";
import { BrandedPdfBuilder, clientSignaturePlaceholder, companySignatureCommands, documentDate, officialSealCommands, pdfLine, pdfRect, pdfText, premiumFooterCommands, watermarkCommands, type DocumentBrandMetadata } from "@/lib/document-branding";
import { digitalSignatureCertificateCommands } from "@/lib/document-branding";

export type QuestionnaireDocumentData = { client?: QuestionnaireAnswers; guarantor?: QuestionnaireAnswers };

export type ClientDocumentType =
  | "convention"
  | "reconnaissance-dette"
  | "checklist-visa"
  | "facture"
  | "lettre-explicative"
  | "lettre-soutien-financier"
  | "lettre-invitation"
  | "procuration"
  | "lettre-autorisation"
  | "recu-paiement";

export type ImmigrationCaseType = "visa_visiteur" | "permis_etudes" | "permis_travail" | "residence_permanente" | "parrainage" | "citoyennete" | "demande_asile" | "renouvellement" | "autre";

export const immigrationCaseLabels:Record<ImmigrationCaseType,string>={visa_visiteur:"Visa visiteur",permis_etudes:"Permis d’études",permis_travail:"Permis de travail",residence_permanente:"Résidence permanente",parrainage:"Parrainage",citoyennete:"Citoyenneté",demande_asile:"Demande d’asile",renouvellement:"Renouvellement",autre:"Autre"};

export type DocumentGenerationOptions = {
  includePersonalInfo?: boolean;
  includeContactInfo?: boolean;
  includeServiceInfo?: boolean;
  includeDocuments?: boolean;
  includeNotes?: boolean;
  includePayments?: boolean;
  includeSignatures?: boolean;
  caseType?: ImmigrationCaseType;
};

export const documentLabels: Record<ClientDocumentType, string> = {
  convention: "Convention de services Accès Canada",
  "reconnaissance-dette": "Reconnaissance de dette",
  "checklist-visa": "Liste de vérification visa visiteur",
  facture: "Facture client",
  "lettre-explicative": "Lettre explicative",
  "lettre-soutien-financier": "Lettre de soutien financier",
  "lettre-invitation": "Lettre d'invitation",
  procuration: "Procuration administrative",
  "lettre-autorisation": "Lettre d'autorisation",
  "recu-paiement": "Reçu de paiement",
};

export const documentLibrary: { type: ClientDocumentType; label: string; description: string }[] = [
  { type: "convention", label: documentLabels.convention, description: "Contrat officiel complet entre Accès Canada et le client." },
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
  { type: "procuration", label: documentLabels.procuration, description: "Autorisation limitée pour les démarches administratives prévues au mandat." },
  { type: "lettre-autorisation", label: documentLabels["lettre-autorisation"], description: "Autorisation écrite de communiquer ou d’agir selon les limites convenues." },
];

const coreDocuments:ClientDocumentType[]=["convention","checklist-visa","facture","recu-paiement","procuration","lettre-autorisation"];
export const caseDocumentRecommendations:Record<ImmigrationCaseType,ClientDocumentType[]>={
  visa_visiteur:[...coreDocuments,"lettre-explicative","lettre-soutien-financier","lettre-invitation"],
  permis_etudes:[...coreDocuments,"lettre-explicative","lettre-soutien-financier"],
  permis_travail:[...coreDocuments,"lettre-explicative"],
  residence_permanente:[...coreDocuments,"lettre-explicative"],
  parrainage:[...coreDocuments,"lettre-explicative","lettre-soutien-financier","lettre-invitation"],
  citoyennete:[...coreDocuments,"lettre-explicative"],
  demande_asile:[...coreDocuments,"lettre-explicative"],
  renouvellement:[...coreDocuments,"lettre-explicative"],
  autre:[...coreDocuments,"lettre-explicative"],
};

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
  return formatUsd(value);
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
  return options.includeSignatures === false ? [] : [];
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
      ["section", "Parties à la convention"],
      ...baseInfo(client, settings),
      ["Agence", "Accès Canada"],
      ["Direction", "Christian Nkuli Mboyo, Directeur général"],
      ["Téléphone", "+1 819 266 8420"],
      ["Courriel", "accesc625@gmail.com"],
      ["section", "Description détaillée du mandat"],
      [
        "Texte",
        `Le client confie à Accès Canada un mandat d'accompagnement administratif relatif à sa demande de ${serviceLabels[client.service as ServiceType] || client.service}. Le mandat comprend l'organisation des renseignements, la vérification de la cohérence documentaire, la préparation des formulaires et documents convenus ainsi que le suivi administratif du dossier. Objet déclaré : ${answer(principal, "travel_purpose", "préparation administrative du dossier d'immigration")}. Toute décision finale relève exclusivement des autorités canadiennes.`,
      ],
      ["Dates prévues", `${answer(principal, "arrival_date")} au ${answer(principal, "departure_date")}`],
      ["Financement", answer(principal, "funding_source")],
      ["section", "Services inclus"],
      ["Texte", "Ouverture et organisation du dossier; analyse administrative des renseignements transmis; liste personnalisée des pièces; préparation des documents convenus; communications de suivi; contrôle final de cohérence avant remise ou dépôt lorsque ce service est expressément prévu."],
      ["Texte", "Les traductions, frais gouvernementaux, examens médicaux, données biométriques, services de tiers et débours non expressément indiqués ne sont pas inclus."],
      ["section", "Honoraires et modalités de paiement"],
      ["Honoraires convenus", money(client.paid_amount)],
      ["Texte", "Les honoraires sont payables selon l'échéancier communiqué au client. Les frais gouvernementaux et débours sont distincts. Tout retard peut suspendre les travaux jusqu'à régularisation, sans prolonger les délais imposés par une autorité."],
      ["section", "Responsabilités du client"],
      ["Texte", "Le client fournit rapidement des renseignements exacts, complets, authentiques et vérifiables; signale tout changement important; relit les documents préparés; respecte les échéances et conserve ses coordonnées à jour."],
      ["section", "Responsabilités d'Accès Canada"],
      ["Texte", "Accès Canada exécute le mandat avec diligence, communique les étapes importantes, protège les renseignements confiés et informe le client des éléments manquants ou incohérents identifiés. Aucun résultat ni délai gouvernemental ne peut être garanti."],
      ["section", "Confidentialité et renseignements personnels"],
      ["Texte", "Les renseignements personnels sont utilisés uniquement pour l'exécution du mandat, la gestion du dossier, la facturation et les obligations légales. Ils ne sont accessibles qu'aux personnes autorisées et aux fournisseurs nécessaires soumis à des mesures de confidentialité et de sécurité."],
      ["section", "Annulation et remboursement"],
      ["Texte", "Le client peut mettre fin au mandat par écrit. Les travaux déjà exécutés, frais engagés et débours demeurent exigibles. Tout remboursement éventuel est calculé selon les services non encore rendus et les conditions particulières acceptées, sous réserve des règles applicables."],
      ["section", "Durée du mandat"],
      ["Texte", "La convention prend effet à sa date de génération et demeure en vigueur jusqu'à l'accomplissement des services convenus, sa résiliation écrite ou la fermeture administrative du dossier."],
      ["section", "Consentements"],
      ["Traitement des renseignements", "Le client consent à la collecte, à l'utilisation, à la conservation et à la communication limitée de ses renseignements personnels pour l'exécution du mandat, conformément aux lois canadiennes applicables en matière de protection des renseignements personnels."],
      ["Communications électroniques", "Le client consent à recevoir par courriel, portail sécurisé ou autre moyen électronique convenu les avis, documents, demandes de renseignements, factures et communications liés à son dossier."],
      ["section", "Conditions générales"],
      ["Texte", "La présente convention constitue l'entente relative au mandat décrit. Toute modification importante doit être constatée par écrit. Si une clause est déclarée inapplicable, les autres demeurent en vigueur. Le droit applicable est celui de la province où Accès Canada exerce ses activités, sous réserve des règles impératives."],
      ["section", "Acceptation"],
      ["Texte", "En signant, le client confirme avoir lu et compris la présente convention, avoir pu poser ses questions et accepter les conditions du mandat."],
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

  if(type==="procuration")return [["section","Mandant"],...baseInfo(client,settings),["section","Mandataire"],["Organisation","Accès Canada"],["Représentant autorisé","Christian Nkuli Mboyo, Directeur général"],["section","Étendue de la procuration"],["Texte","Le client autorise Accès Canada, dans les limites du mandat convenu, à préparer, recevoir, transmettre et organiser les communications et documents administratifs nécessaires au dossier. Cette procuration ne permet aucune déclaration inexacte et peut être révoquée par écrit."],["Durée", "Valide pendant la durée du mandat, sauf révocation écrite antérieure."]];

  if(type==="lettre-autorisation")return [["section","Personne concernée"],...baseInfo(client,settings),["section","Autorisation"],["Texte","Le client autorise Accès Canada à communiquer avec les personnes, organismes et fournisseurs expressément nécessaires à l’exécution du mandat, et à leur transmettre uniquement les renseignements pertinents dans le respect de la confidentialité et des lois applicables."],["Limites","L’autorisation est limitée au dossier identifié et peut être retirée par écrit, sous réserve des actions déjà effectuées."]];

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

export function generateClientPdf(client: AdminClient, type: ClientDocumentType, options: DocumentGenerationOptions = {}, questionnaireData: QuestionnaireDocumentData = {}, metadata: Partial<DocumentBrandMetadata> = {}) {
  const title = documentLabels[type];
  const rows = linesFor(client, type, options, questionnaireData);
  const meta:DocumentBrandMetadata={documentNumber:metadata.documentNumber||`AC-DOC-${client.id.slice(0,8).toUpperCase()}`,verificationToken:metadata.verificationToken||null,authenticityHash:metadata.authenticityHash||null,version:metadata.version||1,status:metadata.status||"active",createdAt:metadata.createdAt||new Date().toISOString(),digitallySigned:metadata.digitallySigned!==false};
  const pages:string[][]=[];let content:string[]=[];let y=610;
  const beginPage=()=>{content=[watermarkCommands(),pdfRect(0,700,612,92,"0.051 0.106 0.165"),pdfRect(0,696,612,4,"0.831 0.686 0.216"),pdfRect(34,724,48,48,"0.831 0.686 0.216"),pdfRect(40,730,36,36,"0.816 0 0"),pdfText("AC",46,742,14,"F2","1 1 1"),pdfText("ACCÈS CANADA",98,752,20,"F2","1 1 1"),pdfText("Votre chemin vers le Canada, notre engagement.",98,735,8.5,"F1","1 1 1"),pdfText(title,36,666,18,"F2","0.051 0.106 0.165"),pdfText(`Créé le ${documentDate(meta.createdAt)}  |  Version ${meta.version}`,36,648,9,"F1","0.390 0.425 0.470"),pdfText(meta.documentNumber,420,648,8.5,"F2","0.816 0 0")];y=610;};
  const finishPage=()=>{pages.push(content);beginPage();};beginPage();
  const ensure=(height:number)=>{if(y-height<108)finishPage();};
  rows.forEach(([label, value]) => {
    if (label === "section") {
      ensure(40);y-=8;content.push(pdfLine(36,y+11,216,y+11,"0.831 0.686 0.216",1.5),pdfText(value,36,y,12,"F2","0.051 0.106 0.165"));y-=25;
      return;
    }
    const wrapped=safe(value).match(/.{1,66}(\s|$)|.{1,66}/g)||[safe(value)],height=Math.max(28,wrapped.length*13+14);ensure(height);content.push(pdfRect(36,y-height+8,540,height,"1 1 1"),pdfText(label,48,y-7,8,"F2","0.051 0.106 0.165"));wrapped.forEach((line,index)=>content.push(pdfText(line.trim(),176,y-7-index*12,9,"F1","0.105 0.133 0.170")));y-=height+5;
  });
  ensure(220);
  content.push(pdfText("VALIDATION ET SIGNATURES",36,y,10,"F2","0.816 0 0"));
  y-=105;
  content.push(companySignatureCommands("director",36,y,170));
  const needsCounsel=["convention","lettre-explicative","lettre-soutien-financier","lettre-invitation"].includes(type);
  if(needsCounsel)content.push(companySignatureCommands("counsel",220,y,170));
  content.push(clientSignaturePlaceholder(410,y,150));
  content.push(digitalSignatureCertificateCommands(meta,36,y-76,540));
  pages.push(content);const builder=new BrandedPdfBuilder();pages.forEach((commands,index)=>builder.addPage(commands.join("")+officialSealCommands(470,76,92,meta.digitallySigned)+premiumFooterCommands(meta,index+1,pages.length)));return builder.finish();
}

export function isClientDocumentType(type: string): type is ClientDocumentType {
  return type in documentLabels;
}

export function documentFileName(client: AdminClient, type: ClientDocumentType) {
  const name = safe(client.full_name).replace(/\s+/g, "-").toLowerCase() || "client";
  return `${type}-${name}.pdf`;
}
