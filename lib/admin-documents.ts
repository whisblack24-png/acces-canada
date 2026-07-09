import type { ClientDocumentType, DocumentGenerationOptions } from "@/lib/pdf-documents";
import { documentLabels } from "@/lib/pdf-documents";

export type GeneratedDocument = {
  id: string;
  created_at: string;
  client_id: string;
  client_name: string;
  document_type: ClientDocumentType;
  document_label: string;
  file_name: string;
  included_information: DocumentGenerationOptions;
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
    super(`${action} Supabase echouee (${status}) : ${details}`);
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

export async function createGeneratedDocument(input: GeneratedDocumentInput) {
  const { url, key, table } = supabaseConfig();
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
    }),
  });

  if (!response.ok) {
    throw await supabaseError("Creation document", response);
  }

  return ((await response.json()) as GeneratedDocument[])[0];
}

export async function deleteGeneratedDocument(id: string) {
  const { url, key, table } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: headers(key),
  });

  if (!response.ok) {
    throw await supabaseError("Suppression document", response);
  }
}
