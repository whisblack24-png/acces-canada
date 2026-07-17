import { NextResponse } from "next/server";
import { getAdminIdentity,isAdminAuthenticated } from "@/lib/admin-auth";
import { getClient } from "@/lib/admin-data";
import { createLibraryItem,duplicateLibraryItem,getLibraryItem,updateLibraryItem } from "@/lib/document-library";
import { createAuditLog } from "@/lib/platform-v2";
import { clientTemplateVariables,replaceTemplateVariables } from "@/lib/template-variables";

export async function POST(request:Request){
  if(!(await isAdminAuthenticated()))return NextResponse.json({error:"Non autorisé."},{status:401});
  const body=await request.json() as Record<string,unknown>,identity=await getAdminIdentity();
  try{
    if(body.action==="duplicate")return NextResponse.json(await duplicateLibraryItem(String(body.id||""),identity?.name||"administrateur"),{status:201});
    if(body.action==="render"){
      const[item,client]=await Promise.all([getLibraryItem(String(body.id||"")),getClient(String(body.clientId||""))]);
      if(!item||!client)return NextResponse.json({error:"Modèle ou client introuvable."},{status:404});
      const rendered=replaceTemplateVariables(item.content||item.description||"",clientTemplateVariables(client));
      await createAuditLog({actorId:identity?.id,action:"render",entityType:"internal_document_library",entityId:item.id,clientId:client.id,summary:`Modèle ${item.title} préparé pour ${client.full_name}.`,metadata:{missingVariables:rendered.missing}});
      return NextResponse.json({item,client:{id:client.id,full_name:client.full_name},...rendered});
    }
    const title=String(body.title||"").trim(),category=String(body.category||"guide") as "lettre"|"courriel"|"procedure"|"guide"|"checklist"|"pdf";
    if(!title)return NextResponse.json({error:"Le titre est obligatoire."},{status:400});
    return NextResponse.json(await createLibraryItem({title,category,description:String(body.description||"").slice(0,1000),content:String(body.content||"").slice(0,30000),tags:String(body.tags||"").split(",").map(v=>v.trim()).filter(Boolean).slice(0,20),createdBy:identity?.name||"administrateur"}),{status:201});
  }catch(error){console.error("Bibliothèque interne",error);return NextResponse.json({error:"Le modèle n’a pas pu être traité."},{status:500});}
}
export async function PATCH(request:Request){
  if(!(await isAdminAuthenticated()))return NextResponse.json({error:"Non autorisé."},{status:401});
  const body=await request.json() as {id?:string;action?:"favorite"|"archive"|"restore";value?:boolean};
  if(!body.id)return NextResponse.json({error:"Modèle invalide."},{status:400});
  try{const patch=body.action==="favorite"?{is_favorite:Boolean(body.value)}:body.action==="archive"?{status:"archived" as const,archived_at:new Date().toISOString()}:{status:"active" as const,archived_at:null};return NextResponse.json(await updateLibraryItem(body.id,patch));}
  catch(error){console.error("Mise à jour bibliothèque",error);return NextResponse.json({error:"La modification n’a pas pu être enregistrée."},{status:500});}
}
