import type { AdminClient } from "@/lib/admin-data";
import type { ClientUploadedDocument } from "@/lib/client-portal";
import type { QuestionnaireRecord, CaseProgress } from "@/lib/questionnaires";
import type { ClientTask } from "@/lib/crm";

export type DossierAnalysis={summary:string;presentDocuments:string[];missingDocuments:string[];inconsistencies:string[];nextSteps:string[];suggestedTasks:string[]};
export type AssistantContext={client:AdminClient;documents:ClientUploadedDocument[];questionnaires:QuestionnaireRecord[];progress:CaseProgress[];tasks:ClientTask[]};

const expectedByService:Record<string,string[]>={visa_visiteur:["Passeport","Preuve financière","Preuve d’emploi ou de commerce","Attaches familiales","Historique de voyages"],permis_etudes:["Passeport","Lettre d’admission","Preuve financière","Diplômes et relevés","Lettre explicative"],permis_travail:["Passeport","Offre d’emploi","Preuves d’expérience","Diplômes","Preuve financière"],residence_permanente:["Passeport","État civil","Diplômes","Expérience professionnelle","Certificats de police"],autre:["Passeport","Pièce d’identité","Preuve financière"]};

export function analyzeDossier(context:AssistantContext):DossierAnalysis{
  const present=[...new Set([...context.documents.filter(d=>d.status==="active").map(d=>d.category),...(context.client.documents_received||[])])];
  const expected=expectedByService[context.client.service]||expectedByService.autre;
  const normalized=present.join(" ").toLocaleLowerCase("fr-CA");
  const missing=[...new Set([...(context.client.documents_missing||[]),...expected.filter(item=>!normalized.includes(item.toLocaleLowerCase("fr-CA").split(" ")[0]))])];
  const inconsistencies:string[]=[];
  if(!context.client.phone)inconsistencies.push("Le numéro de téléphone du client n’est pas renseigné.");
  if(!context.client.country)inconsistencies.push("Le pays de résidence n’est pas renseigné.");
  const partial=context.questionnaires.filter(q=>q.status==="in_progress");
  if(partial.length)inconsistencies.push(`${partial.length} questionnaire(s) sont encore en cours.`);
  const next=context.progress.filter(p=>p.status==="todo"||p.status==="in_progress").slice(0,4).map(p=>p.step_key.replaceAll("_"," "));
  return{summary:`Dossier ${context.client.file_reference||"sans référence"} de ${context.client.full_name}. Service : ${context.client.service.replaceAll("_"," ")}. ${present.length} catégorie(s) de documents présentes et ${missing.length} élément(s) à vérifier.`,presentDocuments:present,missingDocuments:missing,inconsistencies:inconsistencies.length?inconsistencies:["Aucune incohérence structurelle évidente détectée."],nextSteps:next.length?next:["Effectuer la validation administrative finale."],suggestedTasks:[...missing.slice(0,3).map(item=>`Demander : ${item}`),...next.slice(0,2).map(item=>`Faire progresser l’étape : ${item}`)]};
}

function contextText(context:AssistantContext,analysis:DossierAnalysis){return JSON.stringify({client:{nom:context.client.full_name,reference:context.client.file_reference,service:context.client.service,pays:context.client.country,notes:context.client.notes},analyse:analysis,questionnaires:context.questionnaires.map(q=>({type:q.questionnaire_type,statut:q.status,progression:q.progress_percent}))});}

export async function generateAssistantDraft(context:AssistantContext,capability:string,instruction:string){
  const analysis=analyzeDossier(context);const apiKey=process.env.OPENAI_API_KEY;const model=process.env.OPENAI_MODEL||"gpt-5.4";
  if(!apiKey)return{model:null,status:"fallback" as const,text:`BROUILLON À VALIDER\n\nObjet : ${capability.replaceAll("_"," ")} — ${context.client.full_name}\n\nMadame, Monsieur,\n\nNous préparons le dossier ${context.client.file_reference||"en cours de création"} concernant ${context.client.full_name}.\n\n${instruction||analysis.summary}\n\nDocuments ou renseignements à vérifier :\n${analysis.missingDocuments.map(item=>`- ${item}`).join("\n")||"- Aucun élément structurel manquant détecté."}\n\nCordialement,\nAccès Canada`};
  const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({model,instructions:"Tu es l’assistant administratif interne d’Accès Canada. Rédige uniquement un brouillon professionnel en français, factuel et modifiable. Ne rends aucune décision ni opinion juridique. Signale explicitement les éléments à faire valider par un professionnel autorisé.",input:`Capacité: ${capability}\nInstruction: ${instruction}\nDonnées du dossier: ${contextText(context,analysis)}`,max_output_tokens:1800})});
  if(!response.ok)throw new Error(`Service IA indisponible (${response.status}).`);
  const result=await response.json() as {output_text?:string;output?:Array<{content?:Array<{type?:string;text?:string}>}>};
  const text=result.output_text||result.output?.flatMap(item=>item.content||[]).filter(item=>item.type==="output_text").map(item=>item.text||"").join("\n")||"";
  if(!text.trim())throw new Error("L’assistant n’a retourné aucun contenu.");
  return{model,status:"completed" as const,text:text.trim()};
}

export async function logAssistantRun(input:{clientId:string;capability:string;model:string|null;status:"completed"|"failed"|"fallback";text:string;createdBy:string}){const url=process.env.SUPABASE_URL?.replace(/\/$/,"");const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return;await fetch(`${url}/rest/v1/ai_assistant_runs`,{method:"POST",headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({client_id:input.clientId,capability:input.capability,model:input.model,status:input.status,output_text:input.text.slice(0,30000),created_by:input.createdBy})});}
