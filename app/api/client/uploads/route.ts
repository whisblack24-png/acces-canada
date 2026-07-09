import { NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { createClientUpload, listClientUploads, uploadClientFile } from "@/lib/client-portal";

export const runtime = "nodejs";

const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
const maxSize = 8 * 1024 * 1024;

export async function GET() {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ message: "Non autorise." }, { status: 401 });

  try {
    return NextResponse.json({ uploads: await listClientUploads(session.clientId) });
  } catch (error) {
    console.error("Erreur liste uploads client:", error);
    return NextResponse.json({ message: "Impossible de charger les documents envoyes." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ message: "Non autorise." }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ message: "Fichier requis." }, { status: 400 });
    }
    if (!allowedTypes.has(file.type)) {
      return NextResponse.json({ message: "Format accepte : PDF, JPG ou PNG." }, { status: 400 });
    }
    if (file.size > maxSize) {
      return NextResponse.json({ message: "Le fichier ne doit pas depasser 8 Mo." }, { status: 400 });
    }

    const filePath = await uploadClientFile(session.clientId, file);
    const upload = await createClientUpload({
      client_id: session.clientId,
      file_name: file.name,
      file_path: filePath,
      file_type: file.type,
      file_size: file.size,
    });

    return NextResponse.json({ upload }, { status: 201 });
  } catch (error) {
    console.error("Erreur upload client:", error);
    return NextResponse.json({ message: "Impossible d'envoyer le document." }, { status: 500 });
  }
}
