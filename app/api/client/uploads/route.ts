import { NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { createClientUpload, listClientUploads, markClientUploadReceived, replaceClientFile, uploadClientFile } from "@/lib/client-portal";

export const runtime = "nodejs";

const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
const maxSize = 8 * 1024 * 1024;

export async function GET() {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ message: "Non autorisé." }, { status: 401 });

  try {
    return NextResponse.json({ uploads: await listClientUploads(session.clientId) });
  } catch (error) {
    console.error("Erreur liste uploads client:", error);
    return NextResponse.json({ message: "Impossible de charger les documents envoyés." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ message: "Non autorisé." }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const category = String(formData.get("category") || "autre").trim().slice(0, 80) || "autre";
    const replaceId = String(formData.get("replaceId") || "").trim();
    if (!(file instanceof File)) {
      return NextResponse.json({ message: "Fichier requis." }, { status: 400 });
    }
    if (!allowedTypes.has(file.type)) {
      return NextResponse.json({ message: "Format accepte : PDF, JPG ou PNG." }, { status: 400 });
    }
    if (file.size > maxSize) {
      return NextResponse.json({ message: "Le fichier ne doit pas depasser 8 Mo." }, { status: 400 });
    }

    const upload = replaceId
      ? await replaceClientFile(session.clientId, replaceId, file, category)
      : await (async () => {
          const filePath = await uploadClientFile(session.clientId, file);
          return createClientUpload({
            client_id: session.clientId, file_name: file.name, file_path: filePath, file_type: file.type,
            file_size: file.size, category, version: 1, status: "active", replaced_document_id: null,
          });
        })();
    await markClientUploadReceived(session.clientId, file.name);

    return NextResponse.json({ upload }, { status: 201 });
  } catch (error) {
    console.error("Erreur upload client:", error);
    return NextResponse.json({ message: "Impossible d'envoyer le document." }, { status: 500 });
  }
}
