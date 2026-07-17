import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { DOCUMENT_CATEGORY_VALUES, DOCUMENT_MAX_SIZE, DOCUMENT_MIME_TYPES } from "@/lib/document-categories";
import { createClientUpload, replaceClientFile, uploadClientFile } from "@/lib/client-portal";
import { analyzeClientUpload } from "@/lib/document-analysis";

export const runtime = "nodejs";
const allowedTypes = new Set<string>(DOCUMENT_MIME_TYPES);

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const clientId = String(formData.get("clientId") || "").trim();
    const replaceId = String(formData.get("replaceId") || "").trim();
    const requestedCategory = String(formData.get("category") || "correspondance");
    const category = DOCUMENT_CATEGORY_VALUES.has(requestedCategory) ? requestedCategory : "correspondance";
    if (!clientId || !(file instanceof File)) return NextResponse.json({ message: "Client et fichier requis." }, { status: 400 });
    if (!allowedTypes.has(file.type) || file.size > DOCUMENT_MAX_SIZE) {
      return NextResponse.json({ message: "Format PDF, JPG, PNG ou Word, maximum 15 Mo." }, { status: 400 });
    }
    const uploadedBy = "Équipe Accès Canada";
    const upload = replaceId
      ? await replaceClientFile(clientId, replaceId, file, category, uploadedBy)
      : await (async () => {
          const filePath = await uploadClientFile(clientId, file);
          return createClientUpload({
            client_id: clientId, file_name: file.name, file_path: filePath, file_type: file.type,
            file_size: file.size, category, version: 1, status: "active", replaced_document_id: null, uploaded_by: uploadedBy,
          });
        })();
    const analysis=await analyzeClientUpload(upload).catch(error=>{console.error("Analyse documentaire Julie:",error);return null;});
    return NextResponse.json({ upload,analysis }, { status: 201 });
  } catch (error) {
    console.error("Erreur téléversement document administrateur:", error);
    return NextResponse.json({ message: "Impossible d’enregistrer le document." }, { status: 500 });
  }
}
