import { NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { downloadClientFile,markClientDocumentViewed } from "@/lib/client-portal";
import { assertDownloadableFile, downloadHeaders } from "@/lib/file-download";
import {createNotification} from "@/lib/platform-v2";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: Context) {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ message: "Non autorisé." }, { status: 401 });

  const { id } = await context.params;
  const result = await downloadClientFile(session.clientId, id).catch((error) => {
    console.error("Erreur telechargement upload client:", error);
    return null;
  });
  if (!result) return NextResponse.json({ message: "Document introuvable." }, { status: 404 });

  try{assertDownloadableFile(result.bytes,result.record.file_name);}catch(error){return NextResponse.json({message:error instanceof Error?error.message:"Fichier invalide."},{status:422});}
  const viewed=await markClientDocumentViewed(session.clientId,id);if(viewed)await createNotification({clientId:session.clientId,type:"client_document_viewed",title:"Document consulté par le client",message:`${viewed.file_name} a été téléchargé depuis le portail client.`,severity:"success",href:`/admin/clients/${session.clientId}`,dedupeKey:`viewed-${id}`}).catch(()=>undefined);
  const headers=downloadHeaders(result.record.file_name,result.record.file_type);headers["Content-Length"]=String(result.bytes.length);
  return new Response(new Uint8Array(result.bytes),{headers});
}
