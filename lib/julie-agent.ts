import "server-only";

import { createClient, deleteClient, listClients, updateClient, type AdminClient, type ClientInput, type ServiceType } from "@/lib/admin-data";
import { createGeneratedDocument } from "@/lib/admin-documents";
import { analyzeDossier, type AssistantContext } from "@/lib/ai-assistant";
import { cancelAppointment, listAppointments, listAppointmentsForEmail, moveAppointment } from "@/lib/booking";
import { deleteClientFile, listClientUploads, updateClientUploadMetadata, type ClientUploadedDocument } from "@/lib/client-portal";
import { analyzeClientUpload } from "@/lib/document-analysis";
import { documentFileName, type ClientDocumentType } from "@/lib/pdf-documents";
import { createAuditLog, universalSearch } from "@/lib/platform-v2";
import { listClientPayments } from "@/lib/production-workflow";
import { listCaseProgress, listQuestionnaires } from "@/lib/questionnaires";
import { addTimelineEvent, createReminder, createTask, listClientTasks, updateTask } from "@/lib/crm";
import { buildAdminReport } from "@/lib/admin-reports";
import { createSmartDocument, getSmartDocument, listSmartDocuments, type SmartDocumentKind } from "@/lib/smart-documents";
import { planJulieInstruction, type JuliePlannedAction } from "@/lib/julie-orchestrator";
import { createJulieApproval, listJulieApprovals, type JulieMessage } from "@/lib/julie";
import { beginJulieAction, createJulieGoal, finishJulieAction, finishJulieGoal, seedJulieGoalActions, setJulieActionStatus } from "@/lib/julie-runtime";

export type JulieActionResult = { tool: string; status: "completed" | "needs_input" | "failed"; label: string; clientId?: string };
export type JulieExecution = { answer: string; clientIds: string[]; action: "summary" | "incomplete" | "analyze_documents" | "generate_document" | "create_client" | "create_task" | "update_client" | "add_note" | "request_signature" | "answer"; generatedDocumentId?: string; actions?: JulieActionResult[] };

function normalize(value: string) { return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("fr-CA"); }
function friendlyAiFailure(diagnostic:string){if(/QUOTA_IA_ATTEINT|AI_QUOTA|LIMITE_MENSUELLE/.test(diagnostic))return"Le crédit du service IA est actuellement épuisé. Les autres fonctions d’Accès Canada restent disponibles. Ajoutez des crédits dans la plateforme OpenAI pour réactiver les fonctions de Julie.";if(/AUTHENTIFICATION/.test(diagnostic))return"Le service IA n’est pas authentifié. Les autres fonctions d’Accès Canada restent disponibles pendant la correction de la configuration.";return"Le service intelligent de Julie est momentanément indisponible. Aucune action incomplète n’a été présentée comme réussie.";}

function editableClient(client: AdminClient, changes: Partial<ClientInput>): ClientInput {
  return {
    full_name: client.full_name, email: client.email, phone: client.phone || undefined,
    country: client.country || undefined, service: client.service, status: client.status,
    file_reference: client.file_reference || undefined, notes: client.notes || undefined,
    public_notes: client.public_notes || undefined, internal_notes: client.internal_notes || undefined,
    documents_received: client.documents_received || [], documents_missing: client.documents_missing || [],
    action_history: client.action_history || [], paid_amount: client.paid_amount || 0, ...changes,
  };
}

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

async function executeLegacyCommand(instruction: string, selectedClientId?: string): Promise<JulieExecution> {
  const clients = await listClients();
  const command = normalize(instruction);
  if (/cree (le )?dossier|nouveau dossier|ajoute (le )?client/.test(command)) {
    const email = instruction.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0];
    const name = instruction.match(/(?:monsieur|madame|mme|m\.|client)\s+([\p{L}'’ -]{2,80})/iu)?.[1]?.split(/[,.;]|\s+(?:pour|email|courriel|visa|permis)\b/i)[0]?.trim();
    const service: ServiceType = /etude/.test(command) ? "permis_etudes" : /travail/.test(command) ? "permis_travail" : /residence permanente/.test(command) ? "residence_permanente" : /visa|visiteur/.test(command) ? "visa_visiteur" : "autre";
    const missing = [!name ? "le nom complet" : "", !email ? "l’adresse courriel" : "", service === "autre" ? "le type de dossier" : ""].filter(Boolean);
    if (missing.length) return { answer: `Je peux créer ce dossier, mais il me manque ${missing.join(", ")}. Donnez-moi ces renseignements dans votre prochaine commande; je conserverai cet échange dans l’historique.`, clientIds: [], action: "create_client" };
    if (clients.some((client) => normalize(client.full_name) === normalize(name!) || client.email.toLowerCase() === email!.toLowerCase())) return { answer: `Un dossier existe déjà pour ${name} ou ${email}. Je n’ai créé aucun doublon.`, clientIds: [], action: "create_client" };
    const client = await createClient({ full_name: name!, email: email!, service, status: "nouveau", documents_received: [], documents_missing: [], action_history: [{ date: new Date().toISOString(), action: "Dossier créé par Julie depuis une commande en langage naturel." }], paid_amount: 0 });
    await addTimelineEvent(client.id, "Dossier créé par Julie", instruction, "julie");
    await createAuditLog({ actorId: "julie", actorType: "system", action: "create", entityType: "admin_clients", entityId: client.id, clientId: client.id, summary: `Dossier de ${client.full_name} créé par Julie.` });
    return { answer: `J’ai créé le dossier de ${client.full_name} (${client.file_reference || "référence en cours"}) pour ${service.replaceAll("_", " ")}. Le dossier est maintenant disponible dans le CRM.`, clientIds: [client.id], action: "create_client" };
  }
  const targets = findTargets(instruction, clients, selectedClientId);

  if (/prochain rendez-vous|prochains rendez-vous|rendez-vous a venir/.test(command)) {
    const appointments = (targets[0] ? await listAppointmentsForEmail(targets[0].email) : await listAppointments({ status: "confirmed" })).filter((item) => item.status === "confirmed" && new Date(item.starts_at) >= new Date()).sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));
    const next = appointments[0];
    return { answer: next ? `Le prochain rendez-vous${targets[0] ? ` de ${targets[0].full_name}` : ""} est prévu le ${new Date(next.starts_at).toLocaleString("fr-CA")}.` : `Aucun rendez-vous à venir${targets[0] ? ` pour ${targets[0].full_name}` : ""}.`, clientIds: targets[0] ? [targets[0].id] : [], action: "answer" };
  }

  if (/approbations?|actions? en attente/.test(command)) {
    const approvals = await listJulieApprovals();
    return { answer: approvals.length ? [`${approvals.length} action(s) attendent une approbation :`, ...approvals.slice(0, 20).map((item) => `- ${item.title}`)].join("\n") : "Aucune action n’attend une approbation.", clientIds: [...new Set(approvals.map((item) => item.client_id).filter((id): id is string => Boolean(id)))], action: "answer" };
  }

  if (/consultation generale|change.*type|modifie.*type|mets.*dossier.*(visa|permis|consultation|residence)/.test(command)) {
    const client = targets[0];
    if (!client) return { answer: "Sélectionnez ou nommez le client dont le type de dossier doit être modifié.", clientIds: [], action: "update_client" };
    const service = /consultation generale/.test(command) ? "consultation_generale" : /visa/.test(command) ? "visa_visiteur" : /permis.*etude/.test(command) ? "permis_etudes" : /permis.*travail/.test(command) ? "permis_travail" : /residence/.test(command) ? "residence_permanente" : "autre";
    const note = service === "consultation_generale" ? "Type temporaire confirmé dans la conversation avec Julie; le besoin définitif sera précisé après l’entretien avec le client." : `Type de dossier modifié par Julie : ${service.replaceAll("_", " ")}.`;
    await updateClient(client.id, editableClient(client, { service, internal_notes: [client.internal_notes, note].filter(Boolean).join("\n\n"), action_history: [...(client.action_history || []), { date: new Date().toISOString(), action: note }] }));
    await Promise.all([addTimelineEvent(client.id, "Type de dossier modifié", note, "julie"), createAuditLog({ actorId: "julie", actorType: "system", action: "update", entityType: "admin_clients", entityId: client.id, clientId: client.id, summary: note, metadata: { oldValue: client.service, newValue: service } })]);
    return { answer: `C’est fait. Le dossier de ${client.full_name} est maintenant classé comme « ${service.replaceAll("_", " ")} ». J’ai ajouté une note interne et le type pourra être modifié plus tard.`, clientIds: [client.id], action: "update_client" };
  }

  if (/ajoute.*note|cree.*note|note interne/.test(command)) {
    const client = targets[0];
    if (!client) return { answer: "Sélectionnez ou nommez le client auquel ajouter la note.", clientIds: [], action: "add_note" };
    const note = instruction.replace(/^(julie[,.\s]*)?/i, "").replace(/^.*?note(?: interne)?\s*(?:pour\s+[^:,.]+)?[:\s-]*/i, "").trim().slice(0, 4000);
    if (note.length < 3) return { answer: "Indiquez le contenu de la note interne.", clientIds: [client.id], action: "add_note" };
    await updateClient(client.id, editableClient(client, { internal_notes: [client.internal_notes, note].filter(Boolean).join("\n\n"), action_history: [...(client.action_history || []), { date: new Date().toISOString(), action: `Note interne ajoutée : ${note}` }] }));
    await addTimelineEvent(client.id, "Note interne ajoutée par Julie", note, "julie");
    return { answer: `C’est fait. J’ai ajouté la note interne au dossier de ${client.full_name}.`, clientIds: [client.id], action: "add_note" };
  }

  if (/cree.*rappel|ajoute.*rappel|rappelle-moi/.test(command)) {
    const client = targets[0];
    if (!client) return { answer: "Sélectionnez ou nommez le client auquel rattacher le rappel.", clientIds: [], action: "create_task" };
    const remindAt = new Date(); remindAt.setDate(remindAt.getDate() + (/demain/.test(command) ? 1 : 7)); remindAt.setHours(9, 0, 0, 0);
    const title = instruction.replace(/^(julie[,.\s]*)?/i, "").trim().slice(0, 240);
    const reminder = await createReminder(client.id, { title, message: title, remindAt: remindAt.toISOString() });
    return { answer: `J’ai créé le rappel « ${reminder.title} » pour ${client.full_name}, prévu le ${remindAt.toLocaleString("fr-CA")}.`, clientIds: [client.id], action: "create_task" };
  }

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

  if (/signature|a signer|fais signer/.test(command)) {
    const client = targets[0];
    if (!client) return { answer: "Sélectionnez ou nommez le client concerné par la signature.", clientIds: [], action: "request_signature" };
    const type = documentType || "convention";
    const approval = await createJulieApproval({clientId:client.id,actionType:"signature_electronique",title:`Signature à approuver — ${client.full_name}`,description:`Julie a préparé la demande de signature pour ${type.replaceAll("_"," ")}.`,payload:{documentType:type}});
    return { answer: `La demande de signature pour ${client.full_name} est prête. Elle attend votre approbation avant d’être rendue disponible au client.`, clientIds: [client.id], action: "request_signature", actions:[{tool:"request_signature",status:"needs_input",label:`Approbation requise : ${approval.title}`,clientId:client.id}] };
  }

  if (/ajoute.*tache|cree.*tache|rappelle.*de|il faut/.test(command)) {
    const client = targets[0];
    if (!client) return { answer: "Sélectionnez ou nommez le client auquel rattacher cette tâche.", clientIds: [], action: "create_task" };
    const title = instruction.replace(/^(julie[,\s]*)?/i, "").replace(/^(ajoute|crée|cree)\s+(une\s+)?tâche\s*(pour\s+[^:,.]+)?[:\s-]*/i, "").trim().slice(0, 240);
    if (title.length < 3) return { answer: "Indiquez l’action à ajouter dans la liste des tâches.", clientIds: [client.id], action: "create_task" };
    const task = await createTask(client.id, { title, priority: /urgent|priorit/.test(command) ? "urgent" : "normal", assignedTo: "julie" });
    await createAuditLog({ actorId: "julie", actorType: "system", action: "create", entityType: "client_tasks", entityId: task.id, clientId: client.id, summary: `Tâche créée par Julie : ${task.title}.` });
    return { answer: `J’ai ajouté la tâche « ${task.title} » au dossier de ${client.full_name}, avec le statut « à faire »${task.priority === "urgent" ? " et la priorité urgente" : ""}.`, clientIds: [client.id], action: "create_task" };
  }

  if (/prepare tous|prochaines etapes|quoi faire/.test(command)) {
    const client = targets[0];
    if (!client) return { answer: "Sélectionnez ou nommez le client à préparer.", clientIds: [], action: "create_task" };
    const context = await contextFor(client); const analysis = analyzeDossier(context); const existing = new Set(context.tasks.filter((task) => task.status !== "cancelled").map((task) => normalize(task.title)));
    const proposed = [...analysis.missingDocuments.map((item) => `Obtenir : ${item}`), ...analysis.nextSteps.map((item) => `Étape suivante : ${item}`)].slice(0, 12);
    const created = [];
    for (const title of proposed) if (!existing.has(normalize(title))) created.push(await createTask(client.id, { title, priority: "normal", assignedTo: "julie" }));
    await createAuditLog({ actorId: "julie", actorType: "system", action: "plan", entityType: "client_tasks", clientId: client.id, summary: `Plan de travail préparé par Julie (${created.length} nouvelle(s) tâche(s)).` });
    return { answer: `J’ai analysé le dossier de ${client.full_name} et préparé le plan de travail. ${created.length} nouvelle(s) tâche(s) ont été ajoutées sans dupliquer les tâches existantes.\n${proposed.map((item) => `- ${item}`).join("\n")}`, clientIds: [client.id], action: "create_task" };
  }

  if (/recommand|priorit|renforcer|admissib/.test(command)) {
    const client=targets[0];if(!client)return{answer:"Sélectionnez ou nommez le client à analyser.",clientIds:[],action:"answer"};
    const context=await contextFor(client),analysis=analyzeDossier(context),urgent=context.tasks.filter(task=>task.priority==="urgent"&&task.status!=="completed");
    const suggestions=[...analysis.missingDocuments.slice(0,5).map(item=>`Obtenir ou vérifier : ${item}`),...(analysis.inconsistencies[0]?.startsWith("Aucune")?[]:analysis.inconsistencies),...(analysis.missingDocuments.length>2?["Traiter ce dossier en priorité en raison du nombre de pièces à vérifier."]:[]),...(!context.documents.some(document=>normalize(document.category).includes("correspondance"))?["Évaluer avec le responsable autorisé si une lettre explicative factuelle serait utile."]:[])];
    await createAuditLog({actorId:"julie",actorType:"system",action:"recommend",entityType:"admin_clients",entityId:client.id,clientId:client.id,summary:`Recommandations administratives préparées pour ${client.full_name}.`,metadata:{suggestionCount:suggestions.length,urgentTaskCount:urgent.length}});
    return{answer:[`J’ai analysé les données enregistrées pour ${client.full_name}. Recommandations administratives :`,...suggestions.map(item=>`- ${item}`),"\nJe ne conclus pas à l’admissibilité juridique. Cette décision doit être validée par un professionnel autorisé après examen complet des faits et des règles applicables."].join("\n"),clientIds:[client.id],action:"answer"};
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

function stringArg(action: JuliePlannedAction, key: string) { const value = action.arguments?.[key]; return typeof value === "string" ? value.trim() : ""; }

async function resolvePlannedClient(action: JuliePlannedAction, selectedClientId?: string) {
  const clients = await listClients();
  if (selectedClientId) {
    const selected = clients.find((client) => client.id === selectedClientId);
    if (selected) return selected;
  }
  const query = normalize(action.clientQuery || stringArg(action, "full_name"));
  if (!query) return null;
  return clients.find((client) => normalize(client.full_name).includes(query) || query.includes(normalize(client.full_name)) || normalize(client.file_reference || "") === query || client.email.toLowerCase() === query) || null;
}

async function resolveUpload(action: JuliePlannedAction, client: AdminClient) {
  const uploads = (await listClientUploads(client.id)).filter((item) => item.status === "active");
  const id = stringArg(action, "document_id");
  const name = normalize(stringArg(action, "document_name") || stringArg(action, "query"));
  const matches = uploads.filter((item) => id ? item.id === id : name && normalize(item.file_name).includes(name));
  if (!matches.length) throw new Error("Je n’ai trouvé aucun document correspondant dans ce dossier.");
  if (matches.length > 1) throw new Error(`J’ai trouvé ${matches.length} documents correspondants. Précisez le nom exact avant de continuer.`);
  return matches[0] as ClientUploadedDocument;
}

async function executePlannedAction(action: JuliePlannedAction, selectedClientId?: string, originalInstruction=""): Promise<JulieExecution> {
  if (action.tool === "create_client") return createClientFromPlan(action);
  if (action.tool === "search_records") {
    const query = stringArg(action, "query") || action.clientQuery || stringArg(action, "question");
    if (query.length < 2) return { answer: "Quel client, document, paiement ou rendez-vous dois-je rechercher ?", clientIds: [], action: "answer", actions: [{ tool: action.tool, status: "needs_input", label: "Terme de recherche requis" }] };
    const results = await universalSearch(query);
    return { answer: results.length ? [`J’ai trouvé ${results.length} résultat(s) pour « ${query} » :`, ...results.slice(0, 20).map((item) => `- ${item.type} — ${item.title}${item.subtitle ? ` (${item.subtitle})` : ""}`)].join("\n") : `Aucun résultat trouvé pour « ${query} ».`, clientIds: [], action: "answer", actions: [{ tool: action.tool, status: "completed", label: `${results.length} résultat(s) trouvé(s)` }] };
  }
  if (action.tool === "generate_report") {
    const report = await buildAdminReport(await listClients());
    const totals = report.totals;
    return { answer: [`Rapport administratif généré à partir des données réelles :`, `- ${totals.clients} client(s), dont ${totals.activeCases} dossier(s) actif(s)`, `- ${totals.uploadedDocuments} document(s) importé(s) et ${totals.generatedDocuments} document(s) généré(s)`, `- ${totals.documentsMissing} pièce(s) signalée(s) manquante(s)`, `- Revenu enregistré : ${totals.revenue.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}`].join("\n"), clientIds: [], action: "answer", actions: [{ tool: action.tool, status: "completed", label: "Rapport CRM calculé" }] };
  }
  const client = await resolvePlannedClient(action, selectedClientId);
  if (["delete_client", "rename_document", "move_document", "delete_document", "update_task", "create_professional_document", "edit_professional_document", "merge_professional_documents", "prepare_complete_case"].includes(action.tool) && !client) return { answer: "Sélectionnez ou nommez précisément le dossier client concerné.", clientIds: [], action: "answer", actions: [{ tool: action.tool, status: "needs_input", label: "Client requis" }] };
  if (action.tool === "create_professional_document") {
    const plannedSource=stringArg(action,"source_text"),sourceText=plannedSource==="$USER_MESSAGE"?originalInstruction:plannedSource,title=stringArg(action,"title"),category=stringArg(action,"category"),kind=(stringArg(action,"document_kind")||"autre") as SmartDocumentKind;
    const missing=[!title&&"le titre",!category&&"la catégorie",sourceText.length<20&&"le texte source"].filter(Boolean);
    if(missing.length)return{answer:`Il me manque ${missing.join(", ")} pour générer le document professionnel.`,clientIds:[client!.id],action:"answer",actions:[{tool:action.tool,status:"needs_input",label:`Informations requises : ${missing.join(", ")}`,clientId:client!.id}]};
    const result=await createSmartDocument({client:client!,title,category,kind,sourceText,instruction:stringArg(action,"instruction")||undefined});
    await Promise.all([addTimelineEvent(client!.id,"Document professionnel créé",`${title} — version ${result.record.version}, Word et PDF classés dans ${category}.`,"julie"),createAuditLog({actorId:"julie",actorType:"system",action:"generate",entityType:"julie_smart_documents",entityId:result.record.id,clientId:client!.id,summary:`${title} généré en Word et PDF par Julie.`,metadata:{version:result.record.version,category,wordUploadId:result.wordUpload.id,pdfUploadId:result.pdfUpload.id}})]);
    return{answer:`J’ai corrigé et professionnalisé « ${title} », appliqué la mise en page Accès Canada, puis généré et classé les versions Word et PDF dans « ${category} ». La version ${result.record.version} est disponible immédiatement dans les documents du client.`,clientIds:[client!.id],action:"generate_document",actions:[{tool:action.tool,status:"completed",label:`Word et PDF générés — ${title} v${result.record.version}`,clientId:client!.id}]};
  }
  if(action.tool==="merge_professional_documents"){
    const ids=Array.isArray(action.arguments?.document_ids)?action.arguments!.document_ids.map(String).filter(Boolean):[],names=stringArg(action,"document_name").split(/[|,;]/).map(normalize).filter(Boolean),available=await listSmartDocuments(client!.id),sources=available.filter(item=>ids.includes(item.id)||names.some(name=>normalize(item.title).includes(name))),title=stringArg(action,"title"),category=stringArg(action,"category")||sources[0]?.category||"acces_canada";
    if(sources.length<2||!title)return{answer:sources.length<2?"Sélectionnez au moins deux documents professionnels précis à fusionner.":"Indiquez le titre du document fusionné.",clientIds:[client!.id],action:"answer",actions:[{tool:action.tool,status:"needs_input",label:sources.length<2?"Deux documents requis":"Titre requis",clientId:client!.id}]};
    const mergedSource=sources.map((item,index)=>`## ${index+1}. ${item.title}\n\n${item.professional_text}`).join("\n\n").slice(0,30000),result=await createSmartDocument({client:client!,title,category,kind:(stringArg(action,"document_kind")||"autre") as SmartDocumentKind,sourceText:mergedSource,instruction:stringArg(action,"instruction")||"Fusionner ces contenus en un document cohérent, sans répétitions, avec une structure professionnelle unique."});
    await createAuditLog({actorId:"julie",actorType:"system",action:"merge",entityType:"julie_smart_documents",entityId:result.record.id,clientId:client!.id,summary:`${sources.length} documents fusionnés dans ${title}.`,metadata:{sourceIds:sources.map(item=>item.id),wordUploadId:result.wordUpload.id,pdfUploadId:result.pdfUpload.id}});
    return{answer:`J’ai fusionné ${sources.length} documents, harmonisé le contenu et créé « ${title} » en Word et PDF. Les documents sources restent disponibles dans l’historique.`,clientIds:[client!.id],action:"generate_document",actions:[{tool:action.tool,status:"completed",label:`${sources.length} documents fusionnés`,clientId:client!.id}]};
  }
  if(action.tool==="edit_professional_document"){
    const id=stringArg(action,"smart_document_id"),title=normalize(stringArg(action,"title")||stringArg(action,"document_name")),instruction=stringArg(action,"instruction");
    let source=id?await getSmartDocument(id):null;if(!source&&title){const matches=(await listSmartDocuments(client!.id)).filter(item=>normalize(item.title).includes(title));if(matches.length===1)source=matches[0];else if(matches.length>1)return{answer:"Plusieurs versions correspondent. Indiquez l’identifiant ou le titre exact du document.",clientIds:[client!.id],action:"answer",actions:[{tool:action.tool,status:"needs_input",label:"Document à préciser",clientId:client!.id}]};}
    if(source&&source.client_id!==client!.id)source=null;
    if(!source||!instruction)return{answer:!source?"Je n’ai pas retrouvé ce document professionnel dans le dossier client sélectionné.":"Décrivez précisément les modifications à appliquer.",clientIds:[client!.id],action:"answer",actions:[{tool:action.tool,status:"needs_input",label:!source?"Document introuvable dans ce dossier":"Instruction de modification requise",clientId:client!.id}]};
    const result=await createSmartDocument({client:client!,title:source.title,category:source.category,kind:source.document_kind,sourceText:source.professional_text,instruction,parent:source});
    await Promise.all([addTimelineEvent(client!.id,"Nouvelle version documentaire",`${source.title} — version ${result.record.version}. Instruction : ${instruction}`,"julie"),createAuditLog({actorId:"julie",actorType:"system",action:"version",entityType:"julie_smart_documents",entityId:result.record.id,clientId:client!.id,summary:`Nouvelle version de ${source.title} créée.`,metadata:{parentDocumentId:source.id,version:result.record.version,instruction}})]);
    return{answer:`J’ai appliqué les modifications demandées à « ${source.title} ». La version ${result.record.version} Word et PDF est enregistrée; les versions antérieures restent dans l’historique.`,clientIds:[client!.id],action:"generate_document",actions:[{tool:action.tool,status:"completed",label:`Nouvelle version créée — v${result.record.version}`,clientId:client!.id}]};
  }
  if(action.tool==="prepare_complete_case"){
    const context=await contextFor(client!),analysis=analyzeDossier(context),existing=new Set(context.tasks.filter(task=>task.status!=="cancelled").map(task=>normalize(task.title))),created=[];
    for(const title of [...analysis.missingDocuments.map(item=>`Obtenir : ${item}`),...analysis.nextSteps.map(item=>`Étape suivante : ${item}`)].slice(0,15))if(!existing.has(normalize(title)))created.push(await createTask(client!.id,{title,priority:"normal",assignedTo:"julie"}));
    const existingGenerated=await import("@/lib/admin-documents").then(module=>module.listGeneratedDocumentsForClient(client!.id));const generated=[];
    const required:ClientDocumentType[]=["checklist-visa","convention"];for(const type of required)if(!existingGenerated.some(item=>item.document_type===type&&item.status==="active")){generated.push(await createGeneratedDocument({client_id:client!.id,client_name:client!.full_name,document_type:type,file_name:documentFileName(client!,type),included_information:{includeSignatures:true,preparedByJulie:true}}));}
    await createAuditLog({actorId:"julie",actorType:"system",action:"prepare",entityType:"admin_clients",entityId:client!.id,clientId:client!.id,summary:`Dossier complet préparé : ${created.length} tâche(s), ${generated.length} document(s).`,metadata:{missingDocuments:analysis.missingDocuments,generated:generated.map(item=>item.id)}});
    return{answer:[`J’ai préparé le dossier de ${client!.full_name}.`,`- ${analysis.missingDocuments.length} pièce(s) manquante(s) détectée(s)`,`- ${created.length} nouvelle(s) tâche(s) ajoutée(s) sans doublon`,`- ${generated.length} document(s) administratif(s) généré(s)`,`- Prochaines étapes : ${analysis.nextSteps.join("; ")||"aucune étape supplémentaire détectée"}`].join("\n"),clientIds:[client!.id],action:"create_task",actions:[{tool:action.tool,status:"completed",label:"Dossier analysé et plan de travail préparé",clientId:client!.id}]};
  }
  if (action.tool === "delete_client") {
    const deleted = await deleteClient(client!.id, "julie");
    await createAuditLog({ actorId: "julie", actorType: "system", action: "delete", entityType: "admin_clients", entityId: client!.id, clientId: client!.id, summary: `Dossier de ${client!.full_name} supprimé après approbation.` });
    return { answer: `Le dossier de ${deleted.full_name} a été supprimé et l’opération a été journalisée.`, clientIds: [], action: "answer" };
  }
  if (["rename_document", "move_document", "delete_document"].includes(action.tool)) {
    const upload = await resolveUpload(action, client!);
    if (action.tool === "delete_document") {
      await deleteClientFile(client!.id, upload.id);
      await createAuditLog({ actorId: "julie", actorType: "system", action: "delete", entityType: "client_uploaded_documents", entityId: upload.id, clientId: client!.id, summary: `Document « ${upload.file_name} » supprimé après approbation.` });
      return { answer: `Le document « ${upload.file_name} » a été supprimé du dossier de ${client!.full_name}.`, clientIds: [client!.id], action: "answer" };
    }
    const newName = stringArg(action, "new_name");
    const category = stringArg(action, "category");
    if (action.tool === "rename_document" && !newName) return { answer: "Quel nouveau nom dois-je donner à ce document ?", clientIds: [client!.id], action: "answer", actions: [{ tool: action.tool, status: "needs_input", label: "Nouveau nom requis", clientId: client!.id }] };
    if (action.tool === "move_document" && !category) return { answer: "Dans quelle catégorie dois-je déplacer ce document ?", clientIds: [client!.id], action: "answer", actions: [{ tool: action.tool, status: "needs_input", label: "Catégorie requise", clientId: client!.id }] };
    const updated = await updateClientUploadMetadata(client!.id, upload.id, { fileName: newName || undefined, category: category || undefined });
    await createAuditLog({ actorId: "julie", actorType: "system", action: "update", entityType: "client_uploaded_documents", entityId: upload.id, clientId: client!.id, summary: action.tool === "rename_document" ? `Document renommé « ${updated.file_name} ».` : `Document déplacé dans « ${updated.category} ».` });
    return { answer: action.tool === "rename_document" ? `Le document a été renommé « ${updated.file_name} ».` : `Le document « ${updated.file_name} » est maintenant classé dans « ${updated.category} ».`, clientIds: [client!.id], action: "answer" };
  }
  if (action.tool === "update_task") {
    const tasks = await listClientTasks(client!.id); const id = stringArg(action, "task_id"); const title = normalize(stringArg(action, "title"));
    const matches = tasks.filter((task) => id ? task.id === id : title && normalize(task.title).includes(title));
    if (matches.length !== 1) return { answer: matches.length ? "Plusieurs tâches correspondent. Précisez le titre exact." : "Tâche introuvable.", clientIds: [client!.id], action: "answer", actions: [{ tool: action.tool, status: "needs_input", label: "Tâche à préciser", clientId: client!.id }] };
    const status = stringArg(action, "status") as "todo"|"in_progress"|"completed"|"cancelled";
    if (!["todo", "in_progress", "completed", "cancelled"].includes(status)) return { answer: "Indiquez le nouveau statut : à faire, en cours, terminé ou annulé.", clientIds: [client!.id], action: "answer" };
    const updated = await updateTask(matches[0].id, { status });
    return { answer: `La tâche « ${updated.title} » est maintenant « ${status.replaceAll("_", " ")} ».`, clientIds: [client!.id], action: "answer" };
  }
  if (["move_appointment", "cancel_appointment"].includes(action.tool)) {
    const id = stringArg(action, "appointment_id");
    if (!id) return { answer: "Précisez le rendez-vous concerné avant de continuer.", clientIds: client ? [client.id] : [], action: "answer", actions: [{ tool: action.tool, status: "needs_input", label: "Rendez-vous à préciser" }] };
    if (action.tool === "cancel_appointment") {
      const reason = stringArg(action, "reason"); if (!reason) return { answer: "Indiquez la raison de l’annulation.", clientIds: client ? [client.id] : [], action: "answer" };
      const appointment = await cancelAppointment(id, reason); return { answer: `Le rendez-vous ${appointment.booking_reference} a été annulé.`, clientIds: client ? [client.id] : [], action: "answer" };
    }
    const desiredDate = stringArg(action, "desired_date"); if (!desiredDate || Number.isNaN(Date.parse(desiredDate))) return { answer: "Indiquez la nouvelle date et l’heure du rendez-vous.", clientIds: client ? [client.id] : [], action: "answer" };
    const appointment = await moveAppointment(id, desiredDate); return { answer: `Le rendez-vous ${appointment.booking_reference} a été déplacé au ${new Date(appointment.starts_at).toLocaleString("fr-CA")}.`, clientIds: client ? [client.id] : [], action: "answer" };
  }
  return executeLegacyCommand(commandFor(action), selectedClientId);
}

async function createClientFromPlan(action: JuliePlannedAction): Promise<JulieExecution> {
  const args = action.arguments || {};
  const fullName = stringArg(action, "full_name");
  const email = stringArg(action, "email").toLowerCase();
  const phone = stringArg(action, "phone");
  const country = stringArg(action, "country");
  const serviceRaw = stringArg(action, "service");
  const service = normalize(serviceRaw).replace(/\s+/g, "_") || "";
  const missing = [!fullName && "le nom complet", !email && "l'adresse courriel", !service && "le type de dossier"].filter(Boolean);
  if (missing.length) return { answer: `Il me manque ${missing.join(", ")} avant de créer ce dossier. Je n'ai réutilisé aucune donnée du client précédemment sélectionné.`, clientIds: [], action: "create_client", actions: [{ tool: action.tool, status: "needs_input", label: `Création suspendue : ${missing.join(", ")}` }] };
  const clients = await listClients();
  const duplicate = clients.find((client) => client.email.toLowerCase() === email || normalize(client.full_name) === normalize(fullName) || (phone && client.phone && client.phone.replace(/\D/g, "") === phone.replace(/\D/g, "")));
  if (duplicate) return { answer: `J'ai trouvé un dossier possiblement identique : ${duplicate.full_name} (${duplicate.file_reference || duplicate.email}). Je n'ai créé aucun doublon. Confirmez si vous souhaitez utiliser ce dossier ou créer malgré tout un dossier distinct.`, clientIds: [duplicate.id], action: "create_client", actions: [{ tool: action.tool, status: "needs_input", label: "Doublon potentiel à confirmer", clientId: duplicate.id }] };
  const client = await createClient({ full_name: fullName, email, phone: phone || undefined, country: country || undefined, service, status: "nouveau", notes: typeof args.notes === "string" ? args.notes.slice(0, 4000) : undefined, documents_received: [], documents_missing: [], action_history: [{ date: new Date().toISOString(), action: "Dossier créé par Julie depuis une commande structurée." }], paid_amount: 0 });
  await Promise.all([
    addTimelineEvent(client.id, "Dossier créé par Julie", "Données extraites et validées depuis la commande administrative.", "julie"),
    createAuditLog({ actorId: "julie", actorType: "system", action: "create", entityType: "admin_clients", entityId: client.id, clientId: client.id, summary: `Dossier de ${client.full_name} créé par Julie.`, metadata: { source: "model_tool_plan" } }),
  ]);
  return { answer: `J'ai créé le dossier de ${client.full_name} (${client.file_reference || "référence en cours"}) et je l'ai associé au CRM.`, clientIds: [client.id], action: "create_client", actions: [{ tool: action.tool, status: "completed", label: `Dossier créé : ${client.full_name}`, clientId: client.id }] };
}

export async function executeApprovedJulieAction(action: JuliePlannedAction, clientId?: string, originalInstruction=""): Promise<JulieExecution> {
  return executePlannedAction(action, clientId, originalInstruction);
}

function commandFor(action: JuliePlannedAction) {
  const client = action.clientQuery ? ` pour ${action.clientQuery}` : "";
  switch (action.tool) {
    case "summarize_client": return `Fais un résumé complet du dossier${client}`;
    case "list_incomplete_clients": return "Montre-moi les dossiers incomplets et les pièces manquantes";
    case "analyze_documents": return `Analyse, classe et renomme les documents${client}`;
    case "generate_document": return `Génère ${stringArg(action, "document_type") || "une lettre explicative"}${client}`;
    case "create_task": return `Crée une tâche${client}: ${stringArg(action, "title")}`;
    case "create_reminder": return `Crée un rappel${client}: ${stringArg(action, "title")} ${stringArg(action, "desired_date")}`;
    case "update_client": return `Modifie le type du dossier${client} en ${stringArg(action, "service") || stringArg(action, "status")}`;
    case "add_note": return `Ajoute une note interne${client}: ${stringArg(action, "notes")}`;
    case "list_appointments": return `Quel est le prochain rendez-vous${client} ?`;
    case "list_pending_approvals": return "Affiche les actions en attente d’approbation";
    case "request_signature": return `Fais signer ${stringArg(action, "document_type") || "la convention"}${client}`;
    case "recommend": return `Analyse et recommande les prochaines étapes${client}`;
    case "search_records": return `Recherche ${stringArg(action, "query") || stringArg(action, "question")}`;
    case "generate_report": return "Génère un rapport administratif complet";
    case "create_professional_document": return `Crée un document professionnel ${stringArg(action,"title")}${client}`;
    case "edit_professional_document": return `Modifie le document ${stringArg(action,"title")}${client}`;
    case "prepare_complete_case": return `Prépare tous les éléments nécessaires du dossier${client}`;
    default: return `Consulte et réponds à propos du dossier${client}`;
  }
}

export async function executeJulieCommand(instruction: string, selectedClientId?: string, history: JulieMessage[] = [], executionMode:"automatic"|"approval_all"="automatic",runtime?:{conversationId?:string;workingMemory?:Record<string,unknown>;globalMemory?:Array<{memory_type:string;content:string}>}): Promise<JulieExecution> {
  const recallRequest=/derni[eè]re (?:t[aâ]che|action)|(?:viens|venais) (?:de|d['’])ex[eé]cuter|qu['’]est-ce que tu (?:as|avais) fait|reprends? (?:le travail|la mission|o[uù] tu)/i.test(instruction);
  if(recallRequest){
    const lastAnswer=typeof runtime?.workingMemory?.lastAnswer==="string"?runtime.workingMemory.lastAnswer:"";
    const lastRequest=typeof runtime?.workingMemory?.lastUserRequest==="string"?runtime.workingMemory.lastUserRequest:"";
    const lastActions=Array.isArray(runtime?.workingMemory?.lastActions)?runtime.workingMemory.lastActions as Array<{tool?:string;status?:string;label?:string}>:[];
    if(lastAnswer||lastActions.length)return{answer:["Voici le dernier travail que j’ai effectué :",lastRequest?`- Demande : ${lastRequest}`:"",...lastActions.map(action=>`- ${action.label||action.tool||"Action"} — ${(action.status||"terminée").replaceAll("_"," ")}`),lastAnswer?`\nRésultat enregistré :\n${lastAnswer}`:""].filter(Boolean).join("\n"),clientIds:selectedClientId?[selectedClientId]:[],action:"answer",actions:[{tool:"recall_context",status:"completed",label:"Dernière tâche retrouvée dans la mémoire persistante",clientId:selectedClientId}]};
    return{answer:"Je n’ai trouvé aucune tâche antérieure dans cette conversation persistante.",clientIds:selectedClientId?[selectedClientId]:[],action:"answer",actions:[{tool:"recall_context",status:"needs_input",label:"Aucune tâche antérieure enregistrée",clientId:selectedClientId}]};
  }
  const arithmetic = normalize(instruction).match(/(?:combien (?:font|fait)|calcule)\s+(-?\d+(?:[.,]\d+)?)\s*([+\-x*\/])\s*(-?\d+(?:[.,]\d+)?)/);
  if (arithmetic) {
    const left = Number(arithmetic[1].replace(",", ".")), right = Number(arithmetic[3].replace(",", "."));
    const result = arithmetic[2] === "+" ? left + right : arithmetic[2] === "-" ? left - right : /[x*]/.test(arithmetic[2]) ? left * right : right === 0 ? NaN : left / right;
    return { answer: Number.isFinite(result) ? String(result) : "Ce calcul n’est pas défini.", clientIds: [], action: "answer", actions: [{ tool: "local_calculator", status: "completed", label: "Calcul effectué localement, sans appel OpenAI." }] };
  }
  const clients = await listClients();
  const active = selectedClientId ? clients.find((client) => client.id === selectedClientId) : undefined;
  let plan;let planDiagnostic="AI_NOT_CONFIGURED — aucun jeton AI Gateway ou OpenAI disponible.";
  try { plan = await planJulieInstruction({ instruction, activeClient: active ? { id: active.id, name: active.full_name } : null, history,workingMemory:runtime?.workingMemory,globalMemory:runtime?.globalMemory }); }
  catch (error) { planDiagnostic=error instanceof Error?error.message:"Erreur IA inconnue";console.error("Julie planification", {diagnostic:planDiagnostic}); plan = null; }
  if (!plan) {
    const complex=/cr[ée]e|ajoute|modifie|analyse|classe|renomme|g[ée]n[èe]re|signature|envoie/i.test(instruction);
    const friendly=friendlyAiFailure(planDiagnostic);
    if(complex)return{answer:friendly,clientIds:[],action:"answer",actions:[{tool:"intelligent_service",status:"failed",label:friendly}]};
    const safe=await executeLegacyCommand(instruction,selectedClientId);return{...safe,answer:`${friendly}\n\n${safe.answer}`};
  }
  if (plan.clarification && !plan.actions.length) return { answer: plan.clarification, clientIds: [], action: "answer", actions: [{ tool: "clarification", status: "needs_input", label: plan.clarification }] };
  const goalRun=runtime?.conversationId&&plan.actions.length?await createJulieGoal({conversationId:runtime.conversationId,clientId:selectedClientId,objective:instruction,plan:plan.actions,status:executionMode==="approval_all"?"awaiting_approval":"executing"}):null;
  if(goalRun&&runtime?.conversationId)await seedJulieGoalActions({goalRunId:goalRun.id,conversationId:runtime.conversationId,actions:plan.actions});
  const executions: JulieExecution[] = [];
  let workingClientId=plan.ignoreActiveClient?undefined:selectedClientId;
  const mutating=new Set(["create_client","analyze_documents","generate_document","create_task","create_reminder","update_client","add_note","request_signature","rename_document","move_document","update_task","move_appointment","create_professional_document","edit_professional_document","merge_professional_documents","prepare_complete_case"]);
  const alwaysSensitive=new Set(["delete_client","delete_document","cancel_appointment"]);
  const batchActions=executionMode==="approval_all"?plan.actions.filter(item=>(mutating.has(item.tool)||alwaysSensitive.has(item.tool))&&item.tool!=="request_signature"):[];
  let batchApprovalCreated=false;
  for (const [actionIndex,planned] of plan.actions.entries()) {
    try {
      if(batchActions.includes(planned)){
        if(!batchApprovalCreated){
          const labels=batchActions.map(item=>item.tool.replaceAll("_"," "));
          const approval=await createJulieApproval({clientId:workingClientId,actionType:"internal_action",title:`Plan Julie à approuver — ${batchActions.length} action(s)`,description:`Actions qui seront exécutées ensemble : ${labels.join("; ")}.`,payload:{plannedActions:batchActions,actionIndexes:plan.actions.map((item,index)=>batchActions.includes(item)?index:-1).filter(index=>index>=0),instruction,conversationId:runtime?.conversationId,goalRunId:goalRun?.id}});
          if(goalRun)await Promise.all(plan.actions.map((item,index)=>batchActions.includes(item)?setJulieActionStatus(goalRun.id,index,"awaiting_approval",approval.id):Promise.resolve()));
          executions.push({answer:`J’ai regroupé ${batchActions.length} action(s) dans une seule validation :\n${labels.map(label=>`- ${label}`).join("\n")}\n\nUtilisez « Approuver et exécuter tout » pour lancer le plan complet.`,clientIds:workingClientId?[workingClientId]:[],action:"answer",actions:[{tool:"batch_approval",status:"needs_input",label:approval.title,clientId:workingClientId}]});
          batchApprovalCreated=true;
        }
        continue;
      }
      if(alwaysSensitive.has(planned.tool)||(executionMode==="approval_all"&&mutating.has(planned.tool)&&planned.tool!=="request_signature")){
        const approval=await createJulieApproval({clientId:workingClientId,actionType:"internal_action",title:`Action Julie à approuver — ${planned.tool.replaceAll("_"," ")}`,description:alwaysSensitive.has(planned.tool)?`Action sensible : Julie attend votre confirmation explicite avant toute exécution.`:`Mode validation complète : cette action a été préparée mais pas exécutée.`,payload:{planned,actionIndexes:[actionIndex],instruction,conversationId:runtime?.conversationId,goalRunId:goalRun?.id}});
        if(goalRun)await setJulieActionStatus(goalRun.id,actionIndex,"awaiting_approval",approval.id);
        executions.push({answer:`J’ai préparé l’action « ${planned.tool.replaceAll("_"," ")} ». Elle attend votre approbation et aucune modification n’a encore été appliquée.`,clientIds:workingClientId?[workingClientId]:[],action:"answer",actions:[{tool:planned.tool,status:"needs_input",label:approval.title,clientId:workingClientId}]});
        continue;
      }
      const run=goalRun&&runtime?.conversationId?await beginJulieAction({conversationId:runtime.conversationId,goalRunId:goalRun.id,idempotencyKey:`goal:${goalRun.id}:action:${actionIndex}`,actionIndex,tool:planned.tool,payload:planned}):null;if(run?.alreadyCompleted){const cached=run.run.output as JulieExecution|null;if(cached){executions.push(cached);if(cached.clientIds[0])workingClientId=cached.clientIds[0];continue;}}
      const execution = await executePlannedAction(planned, workingClientId, instruction);if(run)await finishJulieAction(run.run.id,"completed",execution);
      if(execution.clientIds[0])workingClientId=execution.clientIds[0];
      executions.push({ ...execution, actions: execution.actions || [{ tool: planned.tool, status: "completed", label: execution.answer.split("\n")[0], clientId: execution.clientIds[0] }] });
    } catch (error) {if(goalRun)await setJulieActionStatus(goalRun.id,actionIndex,"failed");
      executions.push({ answer: error instanceof Error ? error.message : "Action impossible.", clientIds: [], action: "answer", actions: [{ tool: planned.tool, status: "failed", label: error instanceof Error ? error.message : "Action impossible" }] });
    }
  }
  if (!executions.length) return { answer: plan.clarification || "Je n'ai identifié aucune action sûre à exécuter. Précisez le client et le résultat attendu.", clientIds: [], action: "answer", actions: [{ tool: "clarification", status: "needs_input", label: plan.clarification || "Précision requise" }] };
  const finalResult={ answer: [plan.clarification, ...executions.map((item) => item.answer)].filter(Boolean).join("\n\n"), clientIds: [...new Set(executions.flatMap((item) => item.clientIds))], action: executions.at(-1)!.action, generatedDocumentId: executions.find((item) => item.generatedDocumentId)?.generatedDocumentId, actions: executions.flatMap((item) => item.actions || []) };const pending=finalResult.actions.some(item=>item.status==="needs_input"),failed=finalResult.actions.some(item=>item.status==="failed");if(goalRun&&!pending)await finishJulieGoal(goalRun.id,failed?"failed":"completed",finalResult,failed?"Une ou plusieurs actions ont échoué.":undefined);return finalResult;
}
