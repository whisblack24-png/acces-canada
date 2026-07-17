import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { DOCUMENT_CATEGORY_VALUES, DOCUMENT_MAX_SIZE, DOCUMENT_MIME_TYPES } from "@/lib/document-categories";
import { createClientUpload, listAllClientUploads, replaceClientFile, uploadClientFile } from "@/lib/client-portal";
import { analyzeClientUpload } from "@/lib/document-analysis";
import { listClients } from "@/lib/admin-data";

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
    let clientId = String(formData.get("clientId") || "").trim();
    const replaceId = String(formData.get("replaceId") || "").trim();
    const requestedCategory = String(formData.get("category") || "correspondance");
    const category = DOCUMENT_CATEGORY_VALUES.has(requestedCategory) ? requestedCategory : "correspondance";
    if (!files.length) return NextResponse.json({ message: "Au moins un fichier est requis." }, { status: 400 });
    if (!clientId) {
      const haystack = files.map((file) => file.name.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()).join(" ");
      const clients = await listClients();
      const matches = clients.filter((client) => {
        const names = client.full_name.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().split(/\s+/).filter((part) => part.length > 2);
        return Boolean(client.file_reference && haystack.includes(client.file_reference.toLowerCase())) || names.length > 0 && names.every((part) => haystack.includes(part));
      });
      if (matches.length !== 1) return NextResponse.json({ message: matches.length ? "Plusieurs clients correspondent à ces fichiers. Confirmez le dossier avant l’importation." : "Julie n’a pas reconnu le client dans les noms de fichiers. Sélectionnez le dossier à confirmer.", needsConfirmation: true, candidates: matches.map(({ id, full_name, file_reference }) => ({ id, full_name, file_reference })) }, { status: 409 });
      clientId = matches[0].id;
    }
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
    return NextResponse.json({ upload: uploads[0], uploads, resolvedClientId: clientId }, { status: 201 });
  } catch (error) {
    console.error("Erreur téléversement document administrateur:", error);
    return NextResponse.json({ message: "Impossible d’enregistrer le document." }, { status: 500 });
  }
}
