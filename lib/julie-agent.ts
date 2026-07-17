import "server-only";

import { listClients, type AdminClient } from "@/lib/admin-data";
import { createGeneratedDocument } from "@/lib/admin-documents";
import { analyzeDossier, type AssistantContext } from "@/lib/ai-assistant";
import { listAppointmentsForEmail } from "@/lib/booking";
import { listClientUploads } from "@/lib/client-portal";
import { analyzeClientUpload } from "@/lib/document-analysis";
import { documentFileName, type ClientDocumentType } from "@/lib/pdf-documents";
import { createAuditLog } from "@/lib/platform-v2";
import { listClientPayments } from "@/lib/production-workflow";
import { listCaseProgress, listQuestionnaires } from "@/lib/questionnaires";
import { listClientTasks } from "@/lib/crm";

export type JulieExecution = { answer: string; clientIds: string[]; action: "summary" | "incomplete" | "analyze_documents" | "generate_document" | "answer"; generatedDocumentId?: string };

function normalize(value: string) { return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("fr-CA"); }

function findTargets(instruction: string, clients: AdminClient[], selectedId?: string) {
  const query = normalize(instruction);
  const named = clients.filter((client) => {
    const full = normalize(client.full_name);
    return query.includes(full) || full.split(/\s+/).filter((word) => word.length > 2).some((word) => query.includes(word));
  });
  if (named.length) return named;
  const selected = selectedId ? clients.find((client) => client.id === selectedId) : undefined;
  return selected ? [selected] : [];
}

async function contextFor(client: AdminClient): Promise<AssistantContext> {
  const [documents, questionnaires, progress, tasks] = await Promise.all([listClientUploads(client.id, true), listQuestionnaires(client.id), listCaseProgress(client.id), listClientTasks(client.id)]);
  return { client, documents, questionnaires, progress, tasks };
}

async function summarize(client: AdminClient) {
  const [context, payments, appointments] = await Promise.all([contextFor(client), listClientPayments(client.id), listAppointmentsForEmail(client.email)]);
  const analysis = analyzeDossier(context);
  const paidCents = payments.filter((payment) => payment.status === "paid").reduce((total, payment) => total + payment.amount_cents, 0);
  const upcoming = appointments.filter((appointment) => appointment.status === "confirmed" && new Date(appointment.starts_at) >= new Date()).slice(0, 3);
  return [
    `## ${client.full_name}`,
    `- Identité : ${client.full_name} · ${client.email}${client.phone ? ` · ${client.phone}` : ""}${client.country ? ` · ${client.country}` : ""}`,
    `- Référence : ${client.file_reference || "non attribuée"}`,
    `- Type de dossier : ${client.service.replaceAll("_", " ")}`,
    `- État d’avancement : ${client.status.replaceAll("_", " ")}`,
    `- Documents reçus : ${analysis.presentDocuments.join(", ") || "aucun"}`,
    `- Documents manquants : ${analysis.missingDocuments.join(", ") || "aucun détecté"}`,
    `- Paiements reçus : ${(paidCents / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}`,
    `- Rendez-vous à venir : ${upcoming.length ? upcoming.map((item) => new Date(item.starts_at).toLocaleString("fr-CA")).join(", ") : "aucun"}`,
    `- Prochaines étapes : ${analysis.nextSteps.join("; ")}`,
    `- Points d’attention : ${analysis.inconsistencies.join("; ")}`,
  ].join("\n");
}

const generatedTypes: Array<[RegExp, ClientDocumentType]> = [
  [/lettre d['’ ]invitation/, "lettre-invitation"], [/prise en charge|soutien financier/, "lettre-soutien-financier"],
  [/convention|contrat de services?/, "convention"], [/facture/, "facture"], [/re[cç]u/, "recu-paiement"],
  [/procuration/, "procuration"], [/lettre explicative/, "lettre-explicative"], [/autorisation/, "lettre-autorisation"],
];

export async function executeJulieCommand(instruction: string, selectedClientId?: string): Promise<JulieExecution> {
  const clients = await listClients();
  const targets = findTargets(instruction, clients, selectedClientId);
  const command = normalize(instruction);

  if (/dossiers? (incomplets?|a completer)|pieces? manquantes?/.test(command)) {
    const checked = await Promise.all(clients.map(async (client) => ({ client, analysis: analyzeDossier(await contextFor(client)) })));
    const incomplete = checked.filter(({ analysis }) => analysis.missingDocuments.length > 0);
    const answer = incomplete.length ? [`J’ai parcouru ${clients.length} dossiers. ${incomplete.length} sont incomplets :`, ...incomplete.map(({ client, analysis }) => `- ${client.full_name} (${client.file_reference || "sans référence"}) : ${analysis.missingDocuments.join(", ")}`)].join("\n") : `J’ai parcouru ${clients.length} dossiers. Aucun dossier incomplet n’a été détecté.`;
    await createAuditLog({ actorId: "julie", actorType: "system", action: "analyze", entityType: "admin_clients", summary: `Julie a recherché les dossiers incomplets (${incomplete.length} résultat(s)).` });
    return { answer, clientIds: incomplete.map(({ client }) => client.id), action: "incomplete" };
  }

  if (/resum|synthese|etat du dossier/.test(command)) {
    if (!targets.length) return { answer: "Je n’ai pas trouvé le client demandé. Indiquez son nom complet ou sélectionnez son dossier.", clientIds: [], action: "summary" };
    const answers = await Promise.all(targets.map(summarize));
    await Promise.all(targets.map((client) => createAuditLog({ actorId: "julie", actorType: "system", action: "summarize", entityType: "admin_clients", entityId: client.id, clientId: client.id, summary: `Résumé du dossier de ${client.full_name} généré par Julie.` })));
    return { answer: answers.join("\n\n"), clientIds: targets.map((client) => client.id), action: "summary" };
  }

  const documentType = generatedTypes.find(([pattern]) => pattern.test(command))?.[1];
  if (/gener|prepare|cree/.test(command) && documentType) {
    const client = targets[0];
    if (!client) return { answer: "Sélectionnez ou nommez le client pour lequel le document doit être créé.", clientIds: [], action: "generate_document" };
    const document = await createGeneratedDocument({ client_id: client.id, client_name: client.full_name, document_type: documentType, file_name: documentFileName(client, documentType), included_information: { includeSignatures: true } });
    await createAuditLog({ actorId: "julie", actorType: "system", action: "generate", entityType: "admin_generated_documents", entityId: document.id, clientId: client.id, summary: `${document.document_label} généré par Julie pour ${client.full_name}.` });
    return { answer: `J’ai généré « ${document.document_label} » pour ${client.full_name}, rempli les données disponibles, sauvegardé le document et associé celui-ci au dossier client. Le PDF est disponible immédiatement dans les documents générés.`, clientIds: [client.id], action: "generate_document", generatedDocumentId: document.id };
  }

  if (/analys|classe|renomm/.test(command) && /documents?/.test(command)) {
    const client = targets[0];
    if (!client) return { answer: "Sélectionnez ou nommez le client dont les documents doivent être analysés.", clientIds: [], action: "analyze_documents" };
    const uploads = (await listClientUploads(client.id)).filter((upload) => upload.status === "active");
    const results = await Promise.allSettled(uploads.map(analyzeClientUpload));
    const completed = results.filter((result) => result.status === "fulfilled").length;
    return { answer: `J’ai analysé ${uploads.length} document(s) du dossier de ${client.full_name}. ${completed} analyse(s) terminée(s), ${uploads.length - completed} erreur(s). Les fichiers à forte confiance ont été renommés et classés automatiquement; les autres sont signalés pour validation.`, clientIds: [client.id], action: "analyze_documents" };
  }

  if (targets.length) return { answer: `J’ai consulté le dossier réel.\n\n${await summarize(targets[0])}\n\nPrécisez l’action souhaitée : résumer, analyser les documents ou générer un document.`, clientIds: [targets[0].id], action: "answer" };
  return { answer: "Je peux consulter les dossiers réels. Nommez un client ou demandez : « Montre-moi les dossiers incomplets », « Résume le dossier d’Assiatou » ou « Génère une lettre d’invitation pour Elhadj ».", clientIds: [], action: "answer" };
}
