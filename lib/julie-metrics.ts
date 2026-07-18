import "server-only";
import type { AiUsageEvent } from "@/lib/ai-usage";

type SmartRow={client_id:string;document_kind:string;created_at:string};
type AnalysisRow={client_id:string|null;status:string;created_at:string};
type ApprovalRow={client_id:string|null;status:string;execution_duration_ms:number|null;executed_at:string|null};
type GeneratedRow={client_id:string;document_type:string;created_at:string};
type ClientRow={id:string;full_name:string;status:string};
type TaskRow={status:string};
type QuestionnaireRow={status:string;updated_at:string};

function config(){const url=process.env.SUPABASE_URL?.replace(/\/$/,""),key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error("Configuration Supabase manquante pour les métriques Julie.");return{url,key};}
function headers(){const{key}=config();return{apikey:key,Authorization:`Bearer ${key}`};}
async function rows<T>(table:string,query:string){const{url}=config();const response=await fetch(`${url}/rest/v1/${table}?${query}`,{headers:headers(),cache:"no-store"});if(!response.ok)throw new Error(`Métriques ${table} indisponibles (${response.status}).`);return await response.json() as T[];}
function dayKey(value:string){return value.slice(0,10);}

export async function getJulieOperationalMetrics(events:AiUsageEvent[]){
  const [smart,analyses,approvals,generated,clients,tasks,questionnaires]=await Promise.all([
    rows<SmartRow>("julie_smart_documents","select=client_id,document_kind,created_at"),
    rows<AnalysisRow>("document_analyses","select=client_id,status,created_at"),
    rows<ApprovalRow>("julie_approval_requests","select=client_id,status,execution_duration_ms,executed_at"),
    rows<GeneratedRow>("admin_generated_documents","status=neq.deleted&select=client_id,document_type,created_at"),
    rows<ClientRow>("admin_clients","select=id,full_name,status"),
    rows<TaskRow>("client_tasks","select=status"),
    rows<QuestionnaireRow>("client_questionnaires","select=status,updated_at"),
  ]);
  const executed=approvals.filter(item=>item.status==="executed"),durations=executed.map(item=>Number(item.execution_duration_ms||0)).filter(Boolean);
  const clientCounts=new Map<string,number>();for(const row of [...smart,...analyses.filter(item=>item.client_id),...generated] as Array<{client_id:string|null}>){if(row.client_id)clientCounts.set(row.client_id,(clientCounts.get(row.client_id)||0)+1);}
  const names=new Map(clients.map(client=>[client.id,client.full_name]));
  const today=new Date(),todayKey=today.toISOString().slice(0,10),days=Array.from({length:14},(_,index)=>{const date=new Date(today);date.setDate(date.getDate()-(13-index));return date.toISOString().slice(0,10);});
  const daily=days.map(day=>{const dayEvents=events.filter(event=>dayKey(event.created_at)===day);return{day,label:new Date(`${day}T12:00:00`).toLocaleDateString("fr-CA",{month:"short",day:"numeric"}),requests:dayEvents.length,cost:dayEvents.reduce((sum,event)=>sum+Number(event.estimated_cost_usd||0),0)};});
  const weekStart=new Date(today);weekStart.setDate(today.getDate()-6);weekStart.setHours(0,0,0,0);const month=today.toISOString().slice(0,7);
  const timeSavedMinutes=analyses.length*10+smart.length*30+generated.length*20+executed.length*5,hourlyValue=Math.max(0,Number(process.env.JULIE_HOURLY_VALUE_CAD)||35),inactiveStatuses=new Set(["inactif","inactive","ferme","closed","archive","archived"]),totalCost=events.reduce((sum,item)=>sum+Number(item.estimated_cost_usd||0),0);
  const monthly=Array.from({length:12},(_,index)=>{const date=new Date(today.getFullYear(),today.getMonth()-(11-index),1),key=date.toISOString().slice(0,7);return{month:key,label:date.toLocaleDateString("fr-CA",{month:"short"}),documents:smart.filter(item=>item.created_at.startsWith(key)).length+generated.filter(item=>item.created_at.startsWith(key)).length,analyses:analyses.filter(item=>item.created_at.startsWith(key)).length};});
  return{
    documentsAnalyzed:analyses.filter(item=>item.status==="completed"||item.status==="manual_review").length,
    documentsGenerated:smart.length+generated.length,pdfsCreated:smart.length,wordsCreated:smart.length,
    lettersGenerated:smart.filter(item=>item.document_kind==="lettre").length+generated.filter(item=>item.document_type.includes("lettre")).length,
    clientsProcessed:clientCounts.size,approvalsExecuted:executed.length,
    averageProcessingMs:durations.length?Math.round(durations.reduce((sum,value)=>sum+value,0)/durations.length):0,
    generatedToday:smart.filter(item=>dayKey(item.created_at)===todayKey).length+generated.filter(item=>dayKey(item.created_at)===todayKey).length,
    documentsCorrected:smart.length,questionnairesCompleted:questionnaires.filter(item=>item.status==="completed"||item.status==="submitted").length,
    activeClients:clients.filter(item=>!inactiveStatuses.has(String(item.status||"").toLowerCase())).length,inactiveClients:clients.filter(item=>inactiveStatuses.has(String(item.status||"").toLowerCase())).length,pendingTasks:tasks.filter(item=>item.status==="todo"||item.status==="in_progress").length,
    timeSavedMinutes,estimatedSavingsCad:Number((timeSavedMinutes/60*hourlyValue).toFixed(2)),averageCostPerDossier:clientCounts.size?totalCost/clientCounts.size:0,
    costs:{day:events.filter(item=>dayKey(item.created_at)===today.toISOString().slice(0,10)).reduce((sum,item)=>sum+Number(item.estimated_cost_usd||0),0),week:events.filter(item=>new Date(item.created_at)>=weekStart).reduce((sum,item)=>sum+Number(item.estimated_cost_usd||0),0),month:events.filter(item=>item.created_at.startsWith(month)).reduce((sum,item)=>sum+Number(item.estimated_cost_usd||0),0)},
    daily,monthly,byClient:[...clientCounts.entries()].map(([id,count])=>({id,name:names.get(id)||"Client supprimé",count})).sort((a,b)=>b.count-a.count).slice(0,20),
  };
}
