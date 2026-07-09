import type { AdminClient } from "@/lib/admin-data";
import { hashClientCode } from "@/lib/client-auth";

export type ClientUploadedDocument = {
  id: string;
  created_at: string;
  client_id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
};

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configuration Supabase manquante pour le portail client.");
  return {
    url,
    key,
    clientsTable: process.env.SUPABASE_CLIENTS_TABLE || "admin_clients",
    codesTable: process.env.SUPABASE_CLIENT_LOGIN_CODES_TABLE || "client_login_codes",
    uploadsTable: process.env.SUPABASE_CLIENT_UPLOADS_TABLE || "client_uploaded_documents",
    generatedTable: process.env.SUPABASE_DOCUMENTS_TABLE || "admin_generated_documents",
    bucket: process.env.SUPABASE_CLIENT_DOCUMENTS_BUCKET || "client-documents",
  };
}

function headers(key: string) {
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

async function fail(action: string, response: Response) {
  throw new Error(`${action} Supabase echouee (${response.status}) : ${await response.text()}`);
}

export async function findClientByEmail(email: string) {
  const { url, key, clientsTable } = config();
  const response = await fetch(`${url}/rest/v1/${clientsTable}?email=eq.${encodeURIComponent(email.toLowerCase())}&select=*&limit=1`, {
    headers: headers(key),
    cache: "no-store",
  });
  if (!response.ok) await fail("Recherche client", response);
  const clients = (await response.json()) as AdminClient[];
  return clients[0] || null;
}

export async function createLoginCode(clientId: string, email: string, code: string) {
  const { url, key, codesTable } = config();
  const response = await fetch(`${url}/rest/v1/${codesTable}`, {
    method: "POST",
    headers: { ...headers(key), Prefer: "return=minimal" },
    body: JSON.stringify({
      client_id: clientId,
      email: email.toLowerCase(),
      code_hash: hashClientCode(email, code),
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      used_at: null,
    }),
  });
  if (!response.ok) await fail("Creation code client", response);
}

export async function verifyLoginCode(email: string, code: string) {
  const { url, key, codesTable } = config();
  const codeHash = hashClientCode(email, code);
  const response = await fetch(
    `${url}/rest/v1/${codesTable}?email=eq.${encodeURIComponent(email.toLowerCase())}&code_hash=eq.${codeHash}&used_at=is.null&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=*&order=created_at.desc&limit=1`,
    { headers: headers(key), cache: "no-store" },
  );
  if (!response.ok) await fail("Verification code client", response);
  const rows = (await response.json()) as { id: string; client_id: string; email: string }[];
  const row = rows[0];
  if (!row) return null;

  await fetch(`${url}/rest/v1/${codesTable}?id=eq.${encodeURIComponent(row.id)}`, {
    method: "PATCH",
    headers: { ...headers(key), Prefer: "return=minimal" },
    body: JSON.stringify({ used_at: new Date().toISOString() }),
  });

  return { clientId: row.client_id, email: row.email };
}

export async function listClientUploads(clientId: string) {
  const { url, key, uploadsTable } = config();
  const response = await fetch(
    `${url}/rest/v1/${uploadsTable}?client_id=eq.${encodeURIComponent(clientId)}&select=*&order=created_at.desc`,
    { headers: headers(key), cache: "no-store" },
  );
  if (!response.ok) await fail("Liste documents client", response);
  return (await response.json()) as ClientUploadedDocument[];
}

export async function createClientUpload(record: Omit<ClientUploadedDocument, "id" | "created_at">) {
  const { url, key, uploadsTable } = config();
  const response = await fetch(`${url}/rest/v1/${uploadsTable}`, {
    method: "POST",
    headers: { ...headers(key), Prefer: "return=representation" },
    body: JSON.stringify(record),
  });
  if (!response.ok) await fail("Creation document client", response);
  return ((await response.json()) as ClientUploadedDocument[])[0];
}

export async function uploadClientFile(clientId: string, file: File) {
  const { url, key, bucket } = config();
  const extension = file.name.split(".").pop()?.toLowerCase() || "file";
  const cleanName = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${clientId}/${Date.now()}-${cleanName || `document.${extension}`}`;
  const response = await fetch(`${url}/storage/v1/object/${bucket}/${path}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": file.type || "application/octet-stream",
      "x-upsert": "false",
    },
    body: Buffer.from(await file.arrayBuffer()),
  });
  if (!response.ok) await fail("Depot fichier client", response);
  return path;
}

export async function downloadClientFile(clientId: string, uploadId: string) {
  const { url, key, uploadsTable, bucket } = config();
  const metaResponse = await fetch(
    `${url}/rest/v1/${uploadsTable}?id=eq.${encodeURIComponent(uploadId)}&client_id=eq.${encodeURIComponent(clientId)}&select=*&limit=1`,
    { headers: headers(key), cache: "no-store" },
  );
  if (!metaResponse.ok) await fail("Lecture fichier client", metaResponse);
  const records = (await metaResponse.json()) as ClientUploadedDocument[];
  const record = records[0];
  if (!record) return null;

  const fileResponse = await fetch(`${url}/storage/v1/object/${bucket}/${record.file_path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!fileResponse.ok) await fail("Telechargement fichier client", fileResponse);
  return { record, bytes: Buffer.from(await fileResponse.arrayBuffer()) };
}
