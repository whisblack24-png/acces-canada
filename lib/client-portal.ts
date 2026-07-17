import type { AdminClient } from "@/lib/admin-data";
import { hashClientCode } from "@/lib/client-auth";
import { DOCUMENT_MAX_SIZE, DOCUMENT_MIME_TYPES } from "@/lib/document-categories";

export type ClientUploadedDocument = {
  id: string;
  created_at: string;
  client_id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  category: string;
  version: number;
  status: "active" | "replaced" | "deleted";
  replaced_document_id: string | null;
  deleted_at: string | null;
  uploaded_by: string;
};

export type ClientMessage = {
  id: string;
  created_at: string;
  client_id: string;
  sender: "client" | "admin";
  body: string;
  read_at: string | null;
};

const clientDocumentMimeTypes = [...DOCUMENT_MIME_TYPES];
const clientDocumentMaxSize = DOCUMENT_MAX_SIZE;

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
    messagesTable: process.env.SUPABASE_CLIENT_MESSAGES_TABLE || "client_messages",
    bucket: process.env.SUPABASE_CLIENT_DOCUMENTS_BUCKET || "client-documents",
  };
}

function headers(key: string) {
  return {
    ...supabaseAuthHeaders(key),
    "Content-Type": "application/json",
  };
}

function supabaseAuthHeaders(key: string) {
  const base = { apikey: key };

  if (key.startsWith("sb_secret_")) {
    return base;
  }

  return { ...base, Authorization: `Bearer ${key}` };
}

function encodeStoragePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function fail(action: string, response: Response) {
  const details = await response.text();
  console.error(`[Supabase portail client] ${action} échouée`, {
    status: response.status,
    details,
  });
  throw new Error(`${action} Supabase échouée (${response.status}) : ${details}`);
}

async function ensureClientDocumentsBucket() {
  const { url, key, bucket } = config();
  const bucketUrl = `${url}/storage/v1/bucket/${encodeURIComponent(bucket)}`;
  const bucketPayload = {
    public: false,
    file_size_limit: clientDocumentMaxSize,
    allowed_mime_types: clientDocumentMimeTypes,
  };

  const readResponse = await fetch(bucketUrl, {
    headers: supabaseAuthHeaders(key),
    cache: "no-store",
  });

  if (readResponse.ok) {
    const updateResponse = await fetch(bucketUrl, {
      method: "PUT",
      headers: headers(key),
      body: JSON.stringify(bucketPayload),
    });
    if (!updateResponse.ok) await fail("Configuration bucket documents client", updateResponse);
    return;
  }

  if (readResponse.status !== 404) {
    await fail("Vérification du bucket documents client", readResponse);
  }

  const createResponse = await fetch(`${url}/storage/v1/bucket`, {
    method: "POST",
    headers: headers(key),
    body: JSON.stringify({
      id: bucket,
      name: bucket,
      ...bucketPayload,
    }),
  });

  if (!createResponse.ok && createResponse.status !== 409) {
    await fail("Création du bucket documents client", createResponse);
  }

  if (createResponse.status === 409) {
    const updateResponse = await fetch(bucketUrl, {
      method: "PUT",
      headers: headers(key),
      body: JSON.stringify(bucketPayload),
    });
    if (!updateResponse.ok) await fail("Configuration bucket documents client", updateResponse);
  }
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
  if (!response.ok) await fail("Création du code client", response);
}

export async function verifyLoginCode(email: string, code: string) {
  const { url, key, codesTable } = config();
  const codeHash = hashClientCode(email, code);
  const response = await fetch(
    `${url}/rest/v1/${codesTable}?email=eq.${encodeURIComponent(email.toLowerCase())}&code_hash=eq.${codeHash}&used_at=is.null&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=*&order=created_at.desc&limit=1`,
    { headers: headers(key), cache: "no-store" },
  );
  if (!response.ok) await fail("Vérification du code client", response);
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

export async function listClientUploads(clientId: string, includeHistory = false) {
  const { url, key, uploadsTable } = config();
  const response = await fetch(
    `${url}/rest/v1/${uploadsTable}?client_id=eq.${encodeURIComponent(clientId)}${includeHistory ? "" : "&status=eq.active"}&select=*&order=created_at.desc`,
    { headers: headers(key), cache: "no-store" },
  );
  if (!response.ok) await fail("Liste documents client", response);
  return (await response.json()) as ClientUploadedDocument[];
}

export async function listAllClientUploads() {
  const { url, key, uploadsTable } = config();
  const response = await fetch(`${url}/rest/v1/${uploadsTable}?select=*&order=created_at.desc`, {
    headers: headers(key),
    cache: "no-store",
  });
  if (!response.ok) await fail("Liste globale documents clients", response);
  return (await response.json()) as ClientUploadedDocument[];
}

export async function createClientUpload(record: Omit<ClientUploadedDocument, "id" | "created_at" | "deleted_at">) {
  const { url, key, uploadsTable } = config();
  const response = await fetch(`${url}/rest/v1/${uploadsTable}`, {
    method: "POST",
    headers: { ...headers(key), Prefer: "return=representation" },
    body: JSON.stringify(record),
  });
  if (!response.ok) await fail("Création document client", response);
  return ((await response.json()) as ClientUploadedDocument[])[0];
}

export async function markClientUploadReceived(clientId: string, fileName: string) {
  const { url, key, clientsTable } = config();
  const response = await fetch(`${url}/rest/v1/${clientsTable}?id=eq.${encodeURIComponent(clientId)}&select=*&limit=1`, {
    headers: headers(key),
    cache: "no-store",
  });
  if (!response.ok) await fail("Lecture dossier client", response);
  const clients = (await response.json()) as AdminClient[];
  const client = clients[0];
  if (!client) return;

  const received = Array.from(new Set([...(client.documents_received || []), fileName]));
  const history = [
    ...(client.action_history || []),
    { date: new Date().toISOString(), action: `Document déposé par le client : ${fileName}` },
  ].slice(-100);

  const patch = await fetch(`${url}/rest/v1/${clientsTable}?id=eq.${encodeURIComponent(clientId)}`, {
    method: "PATCH",
    headers: { ...headers(key), Prefer: "return=minimal" },
    body: JSON.stringify({
      documents_received: received,
      action_history: history,
      status: client.status === "nouveau" || client.status === "documents_en_attente" || client.status === "en_attente" ? "documents_recus" : client.status,
    }),
  });
  if (!patch.ok) await fail("Mise à jour du dossier après dépôt", patch);
}

export async function uploadClientFile(clientId: string, file: File) {
  const { url, key, bucket } = config();
  await ensureClientDocumentsBucket();
  const extension = file.name.split(".").pop()?.toLowerCase() || "file";
  const cleanName = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${clientId}/${Date.now()}-${cleanName || `document.${extension}`}`;
  const encodedPath = encodeStoragePath(path);
  const response = await fetch(`${url}/storage/v1/object/${encodeURIComponent(bucket)}/${encodedPath}`, {
    method: "POST",
    headers: {
      ...supabaseAuthHeaders(key),
      "Content-Type": file.type || "application/octet-stream",
      "x-upsert": "false",
    },
    body: await file.arrayBuffer(),
  });
  if (!response.ok) await fail("Dépôt du fichier client", response);
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

  const fileResponse = await fetch(`${url}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeStoragePath(record.file_path)}`, {
    headers: supabaseAuthHeaders(key),
    cache: "no-store",
  });
  if (!fileResponse.ok) await fail("Téléchargement du fichier client", fileResponse);
  return { record, bytes: Buffer.from(await fileResponse.arrayBuffer()) };
}

export async function deleteClientFile(clientId: string, uploadId: string) {
  const { url, key, uploadsTable, bucket } = config();
  const metaResponse = await fetch(
    `${url}/rest/v1/${uploadsTable}?id=eq.${encodeURIComponent(uploadId)}&client_id=eq.${encodeURIComponent(clientId)}&select=*&limit=1`,
    { headers: headers(key), cache: "no-store" },
  );
  if (!metaResponse.ok) await fail("Lecture document client", metaResponse);
  const records = (await metaResponse.json()) as ClientUploadedDocument[];
  const record = records[0];
  if (!record) return null;

  const storageResponse = await fetch(`${url}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeStoragePath(record.file_path)}`, {
    method: "DELETE",
    headers: supabaseAuthHeaders(key),
  });
  if (!storageResponse.ok && storageResponse.status !== 404) {
    await fail("Suppression fichier client", storageResponse);
  }

  const deleteResponse = await fetch(`${url}/rest/v1/${uploadsTable}?id=eq.${encodeURIComponent(uploadId)}&client_id=eq.${encodeURIComponent(clientId)}`, {
    method: "PATCH",
    headers: { ...headers(key), Prefer: "return=minimal" },
    body: JSON.stringify({ status: "deleted", deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
  });
  if (!deleteResponse.ok) await fail("Suppression de la référence du document client", deleteResponse);

  return record;
}

export async function renameClientUpload(clientId:string,uploadId:string,fileName:string){
  const {url,key,uploadsTable}=config();
  const response=await fetch(`${url}/rest/v1/${uploadsTable}?id=eq.${encodeURIComponent(uploadId)}&client_id=eq.${encodeURIComponent(clientId)}&status=eq.active`,{method:"PATCH",headers:{...headers(key),Prefer:"return=representation"},body:JSON.stringify({file_name:fileName,updated_at:new Date().toISOString()})});
  if(!response.ok)await fail("Renommage document client",response);
  const row=((await response.json()) as ClientUploadedDocument[])[0];if(!row)throw new Error("Document introuvable.");return row;
}

export async function deleteClientStorageFiles(filePaths: string[]) {
  const { url, key, bucket } = config();
  const failures: string[] = [];

  for (const filePath of [...new Set(filePaths.filter(Boolean))]) {
    const response = await fetch(`${url}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeStoragePath(filePath)}`, {
      method: "DELETE",
      headers: supabaseAuthHeaders(key),
    });
    if (!response.ok && response.status !== 404) failures.push(filePath);
  }

  return failures;
}

export async function replaceClientFile(clientId: string, previousId: string, file: File, category: string, uploadedBy: string) {
  const { url, key, uploadsTable } = config();
  const previousResponse = await fetch(
    `${url}/rest/v1/${uploadsTable}?id=eq.${encodeURIComponent(previousId)}&client_id=eq.${encodeURIComponent(clientId)}&status=eq.active&select=*&limit=1`,
    { headers: headers(key), cache: "no-store" },
  );
  if (!previousResponse.ok) await fail("Lecture du document à remplacer", previousResponse);
  const previous = ((await previousResponse.json()) as ClientUploadedDocument[])[0];
  if (!previous) throw new Error("Document à remplacer introuvable.");

  const filePath = await uploadClientFile(clientId, file);
  const replacement = await createClientUpload({
    client_id: clientId,
    file_name: file.name,
    file_path: filePath,
    file_type: file.type,
    file_size: file.size,
    category: category || previous.category || "autre",
    version: Number(previous.version || 1) + 1,
    status: "active",
    replaced_document_id: previous.id,
    uploaded_by: uploadedBy,
  });
  const patch = await fetch(`${url}/rest/v1/${uploadsTable}?id=eq.${encodeURIComponent(previous.id)}`, {
    method: "PATCH",
    headers: { ...headers(key), Prefer: "return=minimal" },
    body: JSON.stringify({ status: "replaced", updated_at: new Date().toISOString() }),
  });
  if (!patch.ok) await fail("Archivage de l’ancienne version", patch);
  return replacement;
}

export async function restoreClientFileVersion(clientId: string, uploadId: string) {
  const { url, key, uploadsTable } = config();
  const targetResponse = await fetch(`${url}/rest/v1/${uploadsTable}?id=eq.${encodeURIComponent(uploadId)}&client_id=eq.${encodeURIComponent(clientId)}&status=eq.replaced&select=*&limit=1`, { headers: headers(key), cache: "no-store" });
  if (!targetResponse.ok) await fail("Lecture de la version à restaurer", targetResponse);
  const target = ((await targetResponse.json()) as ClientUploadedDocument[])[0];
  if (!target) throw new Error("Version restaurable introuvable.");
  const currentResponse = await fetch(`${url}/rest/v1/${uploadsTable}?client_id=eq.${encodeURIComponent(clientId)}&category=eq.${encodeURIComponent(target.category)}&status=eq.active&select=id`, { headers: headers(key), cache: "no-store" });
  if (!currentResponse.ok) await fail("Lecture de la version active", currentResponse);
  const current = (await currentResponse.json()) as { id:string }[];
  if (current.length) {
    const archived = await fetch(`${url}/rest/v1/${uploadsTable}?id=in.(${current.map((item)=>item.id).join(",")})`, { method:"PATCH", headers:{...headers(key),Prefer:"return=minimal"}, body:JSON.stringify({status:"replaced",updated_at:new Date().toISOString()}) });
    if (!archived.ok) await fail("Archivage de la version active", archived);
  }
  const restored = await fetch(`${url}/rest/v1/${uploadsTable}?id=eq.${encodeURIComponent(target.id)}`, { method:"PATCH", headers:{...headers(key),Prefer:"return=representation"}, body:JSON.stringify({status:"active",deleted_at:null,updated_at:new Date().toISOString(),uploaded_by:"Équipe Accès Canada · restauration"}) });
  if (!restored.ok) await fail("Restauration de la version", restored);
  return ((await restored.json()) as ClientUploadedDocument[])[0];
}

export async function listClientMessages(clientId: string) {
  const { url, key, messagesTable } = config();
  const response = await fetch(
    `${url}/rest/v1/${messagesTable}?client_id=eq.${encodeURIComponent(clientId)}&select=*&order=created_at.asc`,
    { headers: headers(key), cache: "no-store" },
  );
  if (!response.ok) await fail("Liste des messages", response);
  return (await response.json()) as ClientMessage[];
}

export async function listAllClientMessages() {
  const { url, key, messagesTable } = config();
  const response = await fetch(`${url}/rest/v1/${messagesTable}?select=*&order=created_at.desc`, {
    headers: headers(key), cache: "no-store",
  });
  if (!response.ok) await fail("Liste globale des messages", response);
  return (await response.json()) as ClientMessage[];
}

export async function createClientMessage(clientId: string, sender: "client" | "admin", body: string) {
  const { url, key, messagesTable } = config();
  const cleanBody = body.trim().slice(0, 4000);
  if (!cleanBody) throw new Error("Le message est vide.");
  const response = await fetch(`${url}/rest/v1/${messagesTable}`, {
    method: "POST",
    headers: { ...headers(key), Prefer: "return=representation" },
    body: JSON.stringify({ client_id: clientId, sender, body: cleanBody }),
  });
  if (!response.ok) await fail("Envoi du message", response);
  return ((await response.json()) as ClientMessage[])[0];
}
