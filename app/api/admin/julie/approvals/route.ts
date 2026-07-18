import { NextResponse } from "next/server";
import { getAdminIdentity, isAdminAuthenticated } from "@/lib/admin-auth";
import { getClient } from "@/lib/admin-data";
import { approveDocumentReview } from "@/lib/document-analysis";
import { executeApprovedJulieAction } from "@/lib/julie-agent";
import { finishJulieApproval, getJulieApproval, listJulieApprovals, reviewJulieApproval, startJulieApproval } from "@/lib/julie";
import type { JuliePlannedAction } from "@/lib/julie-orchestrator";
import { createAuditLog } from "@/lib/platform-v2";
import { requestSignature } from "@/lib/production-workflow";
import type { ClientDocumentType } from "@/lib/pdf-documents";

export async function GET(request:Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const status=new URL(request.url).searchParams.get("status")||"pending";
  return NextResponse.json(await listJulieApprovals(status));
}

export async function PATCH(request: Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const body = await request.json() as { id?: string; status?: "approved" | "rejected"; note?: string; category?:string };
  if (!body.id || !body.status) return NextResponse.json({ error: "Décision incomplète." }, { status: 400 });
  try {
    const identity = await getAdminIdentity();
    if (!identity?.id) return NextResponse.json({ error: "Identité administrative introuvable." }, { status: 401 });
    const pending = await getJulieApproval(body.id);
    if (!pending) return NextResponse.json({ error: "Cette demande a déjà été traitée." }, { status: 409 });
    if(body.status==="rejected"){
      const row=await reviewJulieApproval(body.id,"rejected",identity.id,String(body.note||"").slice(0,2000));
      await createAuditLog({actorId:identity.id,actorType:"staff",action:"rejected",entityType:"julie_approval_requests",entityId:row.id,clientId:row.client_id||undefined,summary:`Demande refusée par ${identity.name}.`});
      return NextResponse.json({...row,message:"La demande a été refusée."});
    }
    const startedAt=Date.now();
    await startJulieApproval(body.id,identity.id,identity.name,String(body.note||"").slice(0,2000));
    try{
      let result:unknown;
      if(pending.action_type==="document_review"&&pending.client_id) result=await approveDocumentReview({uploadId:String(pending.payload.uploadId||""),analysisId:String(pending.payload.analysisId||"")||undefined,clientId:pending.client_id,reviewedBy:undefined,category:body.category});
      else if(pending.action_type==="internal_action"){
        const planned=pending.payload.planned as JuliePlannedAction|undefined;
        const plannedActions=Array.isArray(pending.payload.plannedActions)?pending.payload.plannedActions as JuliePlannedAction[]:planned?[planned]:[];
        if(!plannedActions.length||plannedActions.some(item=>!item?.tool))throw new Error("Le plan d’action enregistré est incomplet.");
        const results=[];let activeClientId=pending.client_id||undefined;
        for(const item of plannedActions){const execution=await executeApprovedJulieAction(item,activeClientId,String(pending.payload.instruction||""));if(execution.clientIds[0])activeClientId=execution.clientIds[0];results.push(execution);}
        result={executed:results.length,results};
      }else if(pending.action_type==="signature_electronique"&&pending.client_id){const client=await getClient(pending.client_id);if(!client)throw new Error("Client introuvable.");result=await requestSignature(client,String(pending.payload.documentType||"convention") as ClientDocumentType);}
      else throw new Error(`Le type d’action « ${pending.action_type} » n’est pas exécutable.`);
      const row=await finishJulieApproval(body.id,"executed",startedAt,result);
      await createAuditLog({actorId:identity.id,actorType:"staff",action:"executed",entityType:"julie_approval_requests",entityId:row.id,clientId:row.client_id||undefined,summary:`Demande approuvée et exécutée par ${identity.name}.`,metadata:{actionType:row.action_type,durationMs:row.execution_duration_ms,result}});
      return NextResponse.json({...row,result,message:"Action approuvée et exécutée avec succès."});
    }catch(executionError){const message=executionError instanceof Error?executionError.message:"Exécution impossible.";const row=await finishJulieApproval(body.id,"failed",startedAt,undefined,message);console.error("[Julie approbation] exécution échouée",{approvalId:body.id,actionType:pending.action_type,error:message});return NextResponse.json({...row,error:message,message:`L’approbation a été enregistrée, mais l’exécution a échoué : ${message}`},{status:422});}
  } catch (error) {
    const message=error instanceof Error?error.message:"Décision impossible.";console.error("[Julie approbation] décision impossible",{approvalId:body.id,error:message});return NextResponse.json({ error:message }, { status: 400 });
  }
}
