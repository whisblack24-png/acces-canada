import type { ClientDocumentType, DocumentGenerationOptions } from "@/lib/pdf-documents";
import { documentLabels } from "@/lib/pdf-documents";
import { createHash, randomUUID } from "node:crypto";

export type GeneratedDocument = {
  id: string;
  created_at: string;
  client_id: string;
  client_name: string;
  document_type: ClientDocumentType;
  document_label: string;
  file_name: string;
  included_information: DocumentGenerationOptions;
  version: number;
  status: "active" | "replaced" | "deleted";
  replaced_document_id: string | null;
  document_number: string;
  verification_token: string;
  authenticity_hash: string;
  issued_at: string;
  cancelled_at: string | null;
  cancellation_reason: string | null;
};

export type GeneratedDocumentInput = {
  client_id: string;
  client_name: string;
  document_type: ClientDocumentType;
  file_name: string;
  included_information: DocumentGenerationOptions;
};

export class SupabaseDocumentError extends Error {
  status: number;
  details: string;

  constructor(action: string, status: number, details: string) {
    super(`${action} Supabase échouée (${status}) : ${details}`);
    this.name = "SupabaseDocumentError";
    this.status = status;
    this.details = details;
  }
}

function supabaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const table = process.env.SUPABASE_DOCUMENTS_TABLE || "admin_generated_documents";

  if (!url || !key) {
    throw new Error("Configuration Supabase manquante pour le module documents.");
  }

  return { url, key, table };
}

function headers(key: string) {
  const authHeaders: Record<string, string> = key.startsWith("sb_secret_")
    ? { apikey: key }
    : { apikey: key, Authorization: `Bearer ${key}` };

  return {
    ...authHeaders,
    "Content-Type": "application/json",
  };
}

async function supabaseError(action: string, response: Response) {
  return new SupabaseDocumentError(action, response.status, await response.text());
}

export function adminDocumentErrorMessage(error: unknown) {
  if (error instanceof SupabaseDocumentError) {
    return error.message;
  }

  return error instanceof Error ? error.message : "Erreur inconnue.";
}

export function logDocumentError(action: string, error: unknown) {
  if (error instanceof SupabaseDocumentError) {
    console.error(action, { status: error.status, details: error.details, message: error.message });
    return;
  }

  console.error(action, error);
}

export async function listGeneratedDocuments() {
  const { url, key, table } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/${table}?select=*&order=created_at.desc`, {
    headers: headers(key),
    cache: "no-store",
  });

  if (!response.ok) {
    throw await supabaseError("Liste documents", response);
  }

  return (await response.json()) as GeneratedDocument[];
}

export async function listGeneratedDocumentsForClient(clientId: string) {
  const { url, key, table } = supabaseConfig();
  const response = await fetch(
    `${url}/rest/v1/${table}?client_id=eq.${encodeURIComponent(clientId)}&select=*&order=created_at.desc`,
    {
      headers: headers(key),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw await supabaseError("Liste documents client", response);
  }

  return (await response.json()) as GeneratedDocument[];
}

export async function getGeneratedDocument(id: string) {
  const { url, key, table } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&select=*&limit=1`, {
    headers: headers(key),
    cache: "no-store",
  });

  if (!response.ok) {
    throw await supabaseError("Lecture document", response);
  }

  const documents = (await response.json()) as GeneratedDocument[];
  return documents[0] || null;
}

export async function getGeneratedDocumentByVerificationToken(token: string) {
  const { url, key, table } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/${table}?verification_token=eq.${encodeURIComponent(token)}&select=id,document_number,document_type,document_label,status,version,issued_at,created_at,authenticity_hash,cancelled_at,cancellation_reason&limit=1`, { headers: headers(key), cache: "no-store" });
  if (!response.ok) throw await supabaseError("Vérification document", response);
  return ((await response.json()) as Pick<GeneratedDocument, "id" | "document_number" | "document_type" | "document_label" | "status" | "version" | "issued_at" | "created_at" | "authenticity_hash" | "cancelled_at" | "cancellation_reason">[])[0] || null;
}

export async function createGeneratedDocument(input: GeneratedDocumentInput) {
  const { url, key, table } = supabaseConfig();
  const previousResponse = await fetch(`${url}/rest/v1/${table}?client_id=eq.${encodeURIComponent(input.client_id)}&document_type=eq.${encodeURIComponent(input.document_type)}&status=eq.active&select=id,version&order=created_at.desc&limit=1`, { headers: headers(key), cache: "no-store" });
  if (!previousResponse.ok) throw await supabaseError("Lecture version document", previousResponse);
  const previous = ((await previousResponse.json()) as { id:string; version:number }[])[0];
  const verificationToken = randomUUID();
  const documentNumber = `AC-DOC-${new Date().getFullYear()}-${verificationToken.slice(0, 8).toUpperCase()}`;
  const issuedAt = new Date().toISOString();
  const authenticityHash = createHash("sha256").update(`${documentNumber}|${input.client_id}|${input.document_type}|${issuedAt}`).digest("hex");
  const response = await fetch(`${url}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...headers(key), Prefer: "return=representation" },
    body: JSON.stringify({
      client_id: input.client_id,
      client_name: input.client_name,
      document_type: input.document_type,
      document_label: documentLabels[input.document_type],
      file_name: input.file_name,
      included_information: input.included_information,
      version: Number(previous?.version || 0) + 1,
      status: "active",
      replaced_document_id: previous?.id || null,
      document_number: documentNumber,
      verification_token: verificationToken,
      authenticity_hash: authenticityHash,
      issued_at: issuedAt,
    }),
  });

  if (!response.ok) {
    throw await supabaseError("Création document", response);
  }

  const created = ((await response.json()) as GeneratedDocument[])[0];
  if (previous) {
    const archived = await fetch(`${url}/rest/v1/${table}?id=eq.${encodeURIComponent(previous.id)}`, { method:"PATCH", headers:headers(key), body:JSON.stringify({status:"replaced"}) });
    if (!archived.ok) throw await supabaseError("Archivage version document", archived);
  }
  return created;
}

export async function deleteGeneratedDocument(id: string) {
  const { url, key, table } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: headers(key),
    body: JSON.stringify({ status: "deleted" }),
  });

  if (!response.ok) {
    throw await supabaseError("Suppression document", response);
  }
}

export async function renameGeneratedDocument(id:string,fileName:string){const{url,key,table}=supabaseConfig();const response=await fetch(`${url}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&status=eq.active`,{method:"PATCH",headers:{...headers(key),Prefer:"return=representation"},body:JSON.stringify({file_name:fileName})});if(!response.ok)throw await supabaseError("Renommage document",response);const row=((await response.json()) as GeneratedDocument[])[0];if(!row)throw new Error("Document introuvable.");return row;}

export async function restoreGeneratedDocument(id:string){
  const {url,key,table}=supabaseConfig();
  const targetResponse=await fetch(`${url}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&status=eq.replaced&select=*&limit=1`,{headers:headers(key),cache:"no-store"});
  if(!targetResponse.ok)throw await supabaseError("Lecture version générée",targetResponse);
  const target=((await targetResponse.json()) as GeneratedDocument[])[0];if(!target)throw new Error("Version générée introuvable.");
  const activeResponse=await fetch(`${url}/rest/v1/${table}?client_id=eq.${encodeURIComponent(target.client_id)}&document_type=eq.${encodeURIComponent(target.document_type)}&status=eq.active&select=id`,{headers:headers(key),cache:"no-store"});
  if(!activeResponse.ok)throw await supabaseError("Lecture document actif",activeResponse);const active=(await activeResponse.json()) as {id:string}[];
  if(active.length){const archived=await fetch(`${url}/rest/v1/${table}?id=in.(${active.map((item)=>item.id).join(",")})`,{method:"PATCH",headers:headers(key),body:JSON.stringify({status:"replaced"})});if(!archived.ok)throw await supabaseError("Archivage document actif",archived)}
  const restored=await fetch(`${url}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`,{method:"PATCH",headers:{...headers(key),Prefer:"return=representation"},body:JSON.stringify({status:"active"})});if(!restored.ok)throw await supabaseError("Restauration document généré",restored);return((await restored.json()) as GeneratedDocument[])[0];
}
