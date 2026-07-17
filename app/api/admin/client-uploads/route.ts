import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { DOCUMENT_CATEGORY_VALUES, DOCUMENT_MAX_SIZE, DOCUMENT_MIME_TYPES } from "@/lib/document-categories";
import { createClientUpload, listAllClientUploads, replaceClientFile, uploadClientFile } from "@/lib/client-portal";
import { analyzeClientUpload } from "@/lib/document-analysis";

export const runtime = "nodejs";
const allowedTypes = new Set<string>(DOCUMENT_MIME_TYPES);

export async function GET() {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  try { return NextResponse.json({ uploads: await listAllClientUploads() }); }
  catch (error) { console.error("Liste documents Julie:", error); return NextResponse.json({ message: "Impossible de charger les documents." }, { status: 500 }); }
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  try {
    const formData = await request.formData();
    const files = [...formData.getAll("files"), ...formData.getAll("file")].filter((value): value is File => value instanceof File);
    const clientId = String(formData.get("clientId") || "").trim();
    const replaceId = String(formData.get("replaceId") || "").trim();
    const requestedCategory = String(formData.get("category") || "correspondance");
    const category = DOCUMENT_CATEGORY_VALUES.has(requestedCategory) ? requestedCategory : "correspondance";
    if (!clientId || !files.length) return NextResponse.json({ message: "Client et fichier requis." }, { status: 400 });
    if (files.some(file => !allowedTypes.has(file.type) || file.size > DOCUMENT_MAX_SIZE)) {
      return NextResponse.json({ message: "Format PDF, JPG, PNG ou Word, maximum 15 Mo." }, { status: 400 });
    }
    const uploadedBy = "Équipe Accès Canada";
    const uploads = [];
    for (const [index,file] of files.entries()) {
    const upload = replaceId && index === 0
      ? await replaceClientFile(clientId, replaceId, file, category, uploadedBy)
      : await (async () => {
          const filePath = await uploadClientFile(clientId, file);
          return createClientUpload({
            client_id: clientId, file_name: file.name, file_path: filePath, file_type: file.type,
            file_size: file.size, category, version: 1, status: "active", replaced_document_id: null, uploaded_by: uploadedBy,
          });
        })();
    const analysis=await analyzeClientUpload(upload).catch(error=>{console.error("Analyse documentaire Julie:",error);return null;});
    uploads.push({ ...upload, analysis });
    }
    return NextResponse.json({ upload: uploads[0], uploads }, { status: 201 });
  } catch (error) {
    console.error("Erreur téléversement document administrateur:", error);
    return NextResponse.json({ message: "Impossible d’enregistrer le document." }, { status: 500 });
  }
}
