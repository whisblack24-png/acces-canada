import "server-only";
import { assertMonthlyAiBudget, recordAiUsage } from "@/lib/ai-usage";

export type JulieToolName =
  | "create_client" | "summarize_client" | "list_incomplete_clients"
  | "analyze_documents" | "generate_document" | "create_task"
  | "create_reminder" | "update_client" | "add_note"
  | "list_appointments" | "list_pending_approvals"
  | "request_signature" | "recommend" | "answer_from_records"
  | "search_records" | "delete_client" | "rename_document"
  | "move_document" | "delete_document" | "update_task"
  | "move_appointment" | "cancel_appointment" | "generate_report"
  | "create_professional_document" | "edit_professional_document" | "merge_professional_documents" | "prepare_complete_case";

export type JuliePlannedAction = {
  tool: JulieToolName;
  clientQuery?: string;
  arguments?: Record<string, unknown>;
};

export type JuliePlan = {
  scope: "new_client" | "existing_client" | "general";
  ignoreActiveClient: boolean;
  clarification?: string;
  actions: JuliePlannedAction[];
};

const tools: JulieToolName[] = ["create_client", "summarize_client", "list_incomplete_clients", "analyze_documents", "generate_document", "create_task", "create_reminder", "update_client", "add_note", "list_appointments", "list_pending_approvals", "request_signature", "recommend", "answer_from_records", "search_records", "delete_client", "rename_document", "move_document", "delete_document", "update_task", "move_appointment", "cancel_appointment", "generate_report", "create_professional_document", "edit_professional_document", "merge_professional_documents", "prepare_complete_case"];

function credentials() {
  if (process.env.OPENAI_API_KEY) return { url: "https://api.openai.com/v1/chat/completions", token: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL || "gpt-5.4" };
  return null;
}

export async function planJulieInstruction(input: { instruction: string; activeClient?: { id: string; name: string } | null; history?: Array<{ role: string; content: string }>; workingMemory?:Record<string,unknown>; globalMemory?:Array<{memory_type:string;content:string}> }): Promise<JuliePlan | null> {
  const auth = credentials();
  if (!auth) return null;
  await assertMonthlyAiBudget();
  const schema = {
    type: "object", additionalProperties: false,
    properties: {
      scope: { type: "string", enum: ["new_client", "existing_client", "general"] },
      ignoreActiveClient: { type: "boolean" },
      clarification: { type: "string" },
      actions: { type: "array", maxItems: 8, items: { type: "object", additionalProperties: false, properties: {
        tool: { type: "string", enum: tools }, clientQuery: { type: "string" }, arguments: { type: "object", additionalProperties: false, properties: {
          full_name: { type: "string" }, email: { type: "string" }, phone: { type: "string" }, country: { type: "string" }, service: { type: "string" }, status: { type: "string" }, notes: { type: "string" }, desired_date: { type: "string" }, title: { type: "string" }, document_type: { type: "string" }, question: { type: "string" },
          query: { type: "string" }, document_id: { type: "string" }, document_ids:{type:"array",items:{type:"string"}}, document_name: { type: "string" }, new_name: { type: "string" }, category: { type: "string" }, task_id: { type: "string" }, appointment_id: { type: "string" }, reason: { type: "string" }, report_type: { type: "string" }, source_text: { type: "string" }, instruction: { type: "string" }, smart_document_id: { type: "string" }, document_kind: { type: "string" },
        }, required: ["full_name", "email", "phone", "country", "service", "status", "notes", "desired_date", "title", "document_type", "question", "query", "document_id", "document_ids", "document_name", "new_name", "category", "task_id", "appointment_id", "reason", "report_type", "source_text", "instruction", "smart_document_id", "document_kind"] },
      }, required: ["tool", "clientQuery", "arguments"] } },
    }, required: ["scope", "ignoreActiveClient", "clarification", "actions"],
  };
  const history = (input.history || []).slice(-20).map((message) => `${message.role}: ${message.content}`).join("\n");
  const system = `Tu es le planificateur d'actions de Julie, l'assistante administrative d'Accès Canada. Transforme la demande en zéro à huit appels d'outils ordonnés. Ne réponds jamais à partir de connaissances inventées : les réponses sur les dossiers doivent appeler un outil qui lit les données réelles. Utilise le client actif pour les pronoms « ce dossier », « ce client », « sa » et « son ». Consulte l'historique avant de demander une précision déjà fournie. Une demande qui crée un nouveau client a scope=new_client, ignoreActiveClient=true et ne doit jamais reprendre les données d'un autre client. Extrais les champs visibles sans rien inventer. Toute valeur explicite de service, y compris « consultation générale », est un type de dossier valable. update_client modifie service ou status; add_note ajoute une note interne; create_reminder crée un rappel. search_records recherche dans les clients, dossiers, documents, paiements et rendez-vous. create_professional_document reçoit obligatoirement source_text, title, category et document_kind; il corrige et génère Word + PDF. Pour éviter de recopier un long brouillon dans le JSON, mets exactement $USER_MESSAGE dans source_text lorsque le texte source se trouve dans la demande actuelle. edit_professional_document reçoit smart_document_id ou un titre précis, ainsi que instruction, et crée une nouvelle version. prepare_complete_case analyse le dossier, crée les tâches manquantes et génère uniquement les modèles clairement nécessaires. Pour modifier un document ou une tâche, fournis son identifiant si l'utilisateur l'a donné, sinon son nom exact dans document_name ou title. move_document change sa catégorie. Les suppressions, annulations et signatures sont toujours soumises à approbation. Pour un client existant, mets son nom ou sa référence dans clientQuery, ou laisse clientQuery vide pour utiliser le client actif. Si une donnée indispensable manque et ne peut pas être retrouvée, pose une question précise dans clarification au lieu d'inventer.`;
  const requestBody=JSON.stringify({
    model: auth.model,
    messages: [{ role: "system", content: system }, { role: "user", content: `Client actif (simple contexte, jamais une source pour un nouveau client): ${input.activeClient ? `${input.activeClient.name} [${input.activeClient.id}]` : "aucun"}\nMémoire de travail durable:\n${JSON.stringify(input.workingMemory||{})}\nMémoire globale pertinente:\n${(input.globalMemory||[]).map(item=>`- [${item.memory_type}] ${item.content}`).join("\n")||"aucune"}\nHistorique:\n${history || "aucun"}\n\nDemande actuelle:\n${input.instruction}` }],
    response_format: { type: "json_schema", json_schema: { name: "julie_plan", strict: true, schema } },
  });let response:Response|null=null;let details="";for(let attempt=1;attempt<=3;attempt++){try{response=await fetch(auth.url,{method:"POST",headers:{Authorization:`Bearer ${auth.token}`,"Content-Type":"application/json"},body:requestBody,signal:AbortSignal.timeout(30000)});if(response.ok)break;details=(await response.text()).slice(0,400);if(![408,429,500,502,503,504].includes(response.status))break;}catch(error){details=error instanceof Error?error.message:"Délai dépassé";response=null;}}
  if (!response?.ok) {const status=response?.status||0,code=status===401||status===403?"AUTHENTIFICATION_IA_INVALIDE":status===429?"QUOTA_IA_ATTEINT":status>=500?"FOURNISSEUR_IA_INDISPONIBLE":status===0?"DELAI_IA_DEPASSE":"REQUETE_IA_REFUSEE";await recordAiUsage({clientId:input.activeClient?.id,feature:"julie_planning",model:auth.model,status:status===429?"quota_exceeded":"failed",errorCode:code}).catch(()=>undefined);throw new Error(`${code}${status?` (HTTP ${status})`:""}${details?` — ${details}`:""}`);}
  const body = await response.json() as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };
  await recordAiUsage({clientId:input.activeClient?.id,feature:"julie_planning",model:auth.model,inputTokens:body.usage?.prompt_tokens,outputTokens:body.usage?.completion_tokens}).catch(()=>undefined);
  const text = body.choices?.[0]?.message?.content;
  if (!text) throw new Error("Le modèle n'a produit aucun plan d'action.");
  const plan = JSON.parse(text) as JuliePlan;
  if (!Array.isArray(plan.actions) || plan.actions.some((action) => !tools.includes(action.tool))) throw new Error("Plan d'action invalide.");
  if (plan.scope === "new_client") plan.ignoreActiveClient = true;
  return plan;
}
