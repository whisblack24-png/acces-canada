import "server-only";

import { createClient, listClients, type AdminClient, type ServiceType } from "@/lib/admin-data";
import { createGeneratedDocument } from "@/lib/admin-documents";
import { analyzeDossier, type AssistantContext } from "@/lib/ai-assistant";
import { listAppointmentsForEmail } from "@/lib/booking";
import { listClientUploads } from "@/lib/client-portal";
import { analyzeClientUpload } from "@/lib/document-analysis";
import { documentFileName, type ClientDocumentType } from "@/lib/pdf-documents";
import { createAuditLog } from "@/lib/platform-v2";
import { listClientPayments, requestSignature } from "@/lib/production-workflow";
import { listCaseProgress, listQuestionnaires } from "@/lib/questionnaires";
import { addTimelineEvent, createTask, listClientTasks } from "@/lib/crm";
import { planJulieInstruction, type JuliePlannedAction } from "@/lib/julie-orchestrator";
import type { JulieMessage } from "@/lib/julie";

export type JulieActionResult = { tool: string; status: "completed" | "needs_input" | "failed"; label: string; clientId?: string };
export type JulieExecution = { answer: string; clientIds: string[]; action: "summary" | "incomplete" | "analyze_documents" | "generate_document" | "create_client" | "create_task" | "request_signature" | "answer"; generatedDocumentId?: string; actions?: JulieActionResult[] };

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
    const signature = await requestSignature(client, type);
    return { answer: `La demande de signature pour « ${signature.document_label} » est enregistrée pour ${client.full_name}. Le client peut la signer dans son espace sécurisé; une demande identique déjà en attente n’est jamais dupliquée.`, clientIds: [client.id], action: "request_signature" };
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

async function createClientFromPlan(action: JuliePlannedAction): Promise<JulieExecution> {
  const args = action.arguments || {};
  const fullName = stringArg(action, "full_name");
  const email = stringArg(action, "email").toLowerCase();
  const phone = stringArg(action, "phone");
  const country = stringArg(action, "country");
  const serviceRaw = stringArg(action, "service");
  const allowed = new Set<ServiceType>(["visa_visiteur", "permis_etudes", "permis_travail", "residence_permanente", "autre"]);
  const service = allowed.has(serviceRaw as ServiceType) ? serviceRaw as ServiceType : "autre";
  const missing = [!fullName && "le nom complet", !email && "l'adresse courriel", service === "autre" && "le type de dossier"].filter(Boolean);
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

function commandFor(action: JuliePlannedAction) {
  const client = action.clientQuery ? ` pour ${action.clientQuery}` : "";
  switch (action.tool) {
    case "summarize_client": return `Fais un résumé complet du dossier${client}`;
    case "list_incomplete_clients": return "Montre-moi les dossiers incomplets et les pièces manquantes";
    case "analyze_documents": return `Analyse, classe et renomme les documents${client}`;
    case "generate_document": return `Génère ${stringArg(action, "document_type") || "une lettre explicative"}${client}`;
    case "create_task": return `Crée une tâche${client}: ${stringArg(action, "title")}`;
    case "request_signature": return `Fais signer ${stringArg(action, "document_type") || "la convention"}${client}`;
    case "recommend": return `Analyse et recommande les prochaines étapes${client}`;
    default: return `Consulte et réponds à propos du dossier${client}`;
  }
}

export async function executeJulieCommand(instruction: string, selectedClientId?: string, history: JulieMessage[] = []): Promise<JulieExecution> {
  const clients = await listClients();
  const active = selectedClientId ? clients.find((client) => client.id === selectedClientId) : undefined;
  let plan;
  try { plan = await planJulieInstruction({ instruction, activeClient: active ? { id: active.id, name: active.full_name } : null, history }); }
  catch (error) { console.error("Julie planification", error); plan = null; }
  if (!plan) return executeLegacyCommand(instruction, selectedClientId);
  if (plan.clarification && !plan.actions.length) return { answer: plan.clarification, clientIds: [], action: "answer", actions: [{ tool: "clarification", status: "needs_input", label: plan.clarification }] };
  const executions: JulieExecution[] = [];
  for (const planned of plan.actions) {
    try {
      const execution = planned.tool === "create_client" ? await createClientFromPlan(planned) : await executeLegacyCommand(commandFor(planned), plan.ignoreActiveClient ? undefined : selectedClientId);
      executions.push({ ...execution, actions: execution.actions || [{ tool: planned.tool, status: "completed", label: execution.answer.split("\n")[0], clientId: execution.clientIds[0] }] });
    } catch (error) {
      executions.push({ answer: error instanceof Error ? error.message : "Action impossible.", clientIds: [], action: "answer", actions: [{ tool: planned.tool, status: "failed", label: error instanceof Error ? error.message : "Action impossible" }] });
    }
  }
  if (!executions.length) return { answer: plan.clarification || "Je n'ai identifié aucune action sûre à exécuter. Précisez le client et le résultat attendu.", clientIds: [], action: "answer", actions: [{ tool: "clarification", status: "needs_input", label: plan.clarification || "Précision requise" }] };
  return { answer: [plan.clarification, ...executions.map((item) => item.answer)].filter(Boolean).join("\n\n"), clientIds: [...new Set(executions.flatMap((item) => item.clientIds))], action: executions.at(-1)!.action, generatedDocumentId: executions.find((item) => item.generatedDocumentId)?.generatedDocumentId, actions: executions.flatMap((item) => item.actions || []) };
}
