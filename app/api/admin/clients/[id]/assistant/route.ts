import { NextResponse } from "next/server";
import { getAdminIdentity,isAdminAuthenticated } from "@/lib/admin-auth";
import { getClient } from "@/lib/admin-data";
import { listClientUploads } from "@/lib/client-portal";
import { listCaseProgress,listQuestionnaires } from "@/lib/questionnaires";
import { listClientTasks } from "@/lib/crm";
import { generateAssistantDraft,logAssistantRun } from "@/lib/ai-assistant";
import { createJulieApproval } from "@/lib/julie";
import { createAuditLog } from "@/lib/platform-v2";
const approvalMap:Record<string,string>={lettre_explicative:"lettre_explicative",preparation_convention:"convention",preparation_procuration:"procuration",reconnaissance_dette:"reconnaissance_dette"};
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  if(!(await isAdminAuthenticated()))return NextResponse.json({error:"Non autorisé."},{status:401});
  const{id}=await params,body=await request.json() as{capability?:string;instruction?:string},capability=String(body.capability||"resume_dossier").slice(0,80);
  try{const[client,documents,questionnaires,progress,tasks,identity]=await Promise.all([getClient(id),listClientUploads(id,true),listQuestionnaires(id),listCaseProgress(id),listClientTasks(id),getAdminIdentity()]);if(!client)return NextResponse.json({error:"Client introuvable."},{status:404});const result=await generateAssistantDraft({client,documents,questionnaires,progress,tasks},capability,String(body.instruction||"").slice(0,2000));await logAssistantRun({clientId:id,capability,model:result.model,status:result.status,text:result.text,createdBy:identity?.name||"administrateur"});const actionType=approvalMap[capability];let approval=null;if(actionType)approval=await createJulieApproval({clientId:id,staffId:identity?.id,actionType,title:`Brouillon préparé par Julie — ${capability.replaceAll("_"," ")}`,description:`Brouillon préparé pour ${client.full_name}.`,payload:{capability,assistantRunStatus:result.status}});await createAuditLog({actorId:"julie",actorType:"system",action:"prepare",entityType:"client_assistant_draft",entityId:approval?.id,clientId:id,summary:`Julie a préparé : ${capability.replaceAll("_"," ")}.`,metadata:{approvalRequired:Boolean(actionType)}});return NextResponse.json({...result,approvalRequired:Boolean(actionType),approval});}catch(error){console.error("Julie — dossier client",error);return NextResponse.json({error:"Julie n’a pas pu préparer ce brouillon. Aucune donnée du dossier n’a été modifiée."},{status:500});}
}
