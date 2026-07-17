import { NextResponse } from "next/server";
import { getAdminIdentity, isAdminAuthenticated } from "@/lib/admin-auth";
import { getClient } from "@/lib/admin-data";
import { listClientUploads } from "@/lib/client-portal";
import { listCaseProgress, listQuestionnaires } from "@/lib/questionnaires";
import { listClientTasks } from "@/lib/crm";
import { generateAssistantDraft, logAssistantRun } from "@/lib/ai-assistant";

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){if(!(await isAdminAuthenticated()))return NextResponse.json({error:"Non autorisé."},{status:401});const{id}=await params;const body=await request.json() as {capability?:string;instruction?:string};const capability=String(body.capability||"resume_dossier").slice(0,80);try{const[client,documents,questionnaires,progress,tasks,identity]=await Promise.all([getClient(id),listClientUploads(id,true),listQuestionnaires(id),listCaseProgress(id),listClientTasks(id),getAdminIdentity()]);if(!client)return NextResponse.json({error:"Client introuvable."},{status:404});const result=await generateAssistantDraft({client,documents,questionnaires,progress,tasks},capability,String(body.instruction||"").slice(0,2000));await logAssistantRun({clientId:id,capability,model:result.model,status:result.status,text:result.text,createdBy:identity?.name||"administrateur"});return NextResponse.json(result);}catch(error){console.error("Assistant Accès Canada",error);return NextResponse.json({error:"L’assistant n’a pas pu préparer ce brouillon. Aucune donnée du dossier n’a été modifiée."},{status:500});}}
