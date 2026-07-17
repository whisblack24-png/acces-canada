import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { adminDocumentErrorMessage, deleteGeneratedDocument, logDocumentError, renameGeneratedDocument } from "@/lib/admin-documents";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: Request, context: Context) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    await deleteGeneratedDocument(id);
    return NextResponse.json({ message: "Document supprime." });
  } catch (error) {
    logDocumentError("Erreur suppression document", error);
    return NextResponse.json({ message: `Impossible de supprimer le document. ${adminDocumentErrorMessage(error)}` }, { status: 500 });
  }
}

export async function PATCH(request:Request,context:Context){if(!(await isAdminAuthenticated()))return NextResponse.json({message:"Non autorisé."},{status:401});const{id}=await context.params;const body=await request.json() as{file_name?:string};const fileName=String(body.file_name||"").trim().slice(0,240);if(!fileName)return NextResponse.json({message:"Nom requis."},{status:400});try{return NextResponse.json({document:await renameGeneratedDocument(id,fileName)});}catch(error){logDocumentError("Erreur renommage document",error);return NextResponse.json({message:`Impossible de renommer le document. ${adminDocumentErrorMessage(error)}`},{status:500});}}
