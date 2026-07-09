export type ClientStatus = "nouveau" | "en_attente" | "incomplet" | "en_traitement" | "termine" | "refuse";
export type ServiceType = "visa_visiteur" | "permis_etudes" | "permis_travail" | "residence_permanente" | "autre";

export type ActionHistoryItem = {
  date: string;
  action: string;
};

export type AdminClient = {
  id: string;
  created_at: string;
  updated_at?: string;
  full_name: string;
  email: string;
  phone: string | null;
  country: string | null;
  service: string;
  status: ClientStatus;
  file_reference: string | null;
  notes: string | null;
  public_notes: string | null;
  internal_notes: string | null;
  documents_received: string[] | null;
  documents_missing: string[] | null;
  action_history: ActionHistoryItem[] | null;
  paid_amount: number;
};

export type ClientInput = {
  full_name: string;
  email: string;
  phone?: string;
  country?: string;
  service: string;
  status: ClientStatus;
  file_reference?: string;
  notes?: string;
  public_notes?: string;
  internal_notes?: string;
  documents_received?: string[];
  documents_missing?: string[];
  action_history?: ActionHistoryItem[];
  paid_amount?: number;
};

export const dossierStatuses: ClientStatus[] = ["nouveau", "en_attente", "incomplet", "en_traitement", "termine", "refuse"];
export const serviceTypes: ServiceType[] = ["visa_visiteur", "permis_etudes", "permis_travail", "residence_permanente", "autre"];

const legacyStatusMap: Record<string, ClientStatus> = {
  prospect: "nouveau",
  active: "en_traitement",
  waiting: "en_attente",
  approved: "termine",
  closed: "termine",
};

export const statusLabels: Record<ClientStatus, string> = {
  nouveau: "Nouveau",
  en_attente: "En attente",
  incomplet: "Incomplet",
  en_traitement: "En traitement",
  termine: "Terminé",
  refuse: "Refusé",
};

export const serviceLabels: Record<ServiceType, string> = {
  visa_visiteur: "Visa visiteur",
  permis_etudes: "Permis d'études",
  permis_travail: "Permis de travail",
  residence_permanente: "Résidence permanente",
  autre: "Autre",
};

export class SupabaseAdminError extends Error {
  status: number;
  details: string;

  constructor(action: string, status: number, details: string) {
    super(`${action} Supabase échouée (${status}) : ${details}`);
    this.name = "SupabaseAdminError";
    this.status = status;
    this.details = details;
  }
}

function supabaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const table = process.env.SUPABASE_CLIENTS_TABLE || "admin_clients";
  const missing = [
    !url || url.includes("TON-PROJET") ? "SUPABASE_URL" : "",
    !key || key.includes("TA_SERVICE_ROLE_KEY") ? "SUPABASE_SERVICE_ROLE_KEY" : "",
  ].filter(Boolean);

  if (missing.length) {
    throw new Error(`Configuration Supabase manquante pour l'espace admin: ${missing.join(", ")}.`);
  }

  return { url: url as string, key: key as string, table };
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

function clientPayload(input: ClientInput, mode: "full" | "compatible" = "full") {
  const base = {
    full_name: input.full_name,
    email: input.email,
    service: input.service,
    status: input.status,
  };

  if (mode === "compatible") {
    return base;
  }

  return {
    ...base,
    phone: input.phone || null,
    country: input.country || null,
    file_reference: input.file_reference || null,
    notes: input.notes || null,
    public_notes: input.public_notes || null,
    internal_notes: input.internal_notes || null,
    documents_received: input.documents_received || [],
    documents_missing: input.documents_missing || [],
    action_history: input.action_history?.length ? input.action_history : [
      { date: new Date().toISOString(), action: "Fiche client mise à jour dans le CRM." },
    ],
    paid_amount: Number(input.paid_amount || 0),
  };
}

async function supabaseError(action: string, response: Response) {
  const details = await response.text();
  return new SupabaseAdminError(action, response.status, details);
}

function looksLikeMissingColumn(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /column|schema cache|PGRST204|PGRST202|Could not find/i.test(message);
}

function logSupabaseError(action: string, error: unknown) {
  if (error instanceof SupabaseAdminError) {
    console.error(action, {
      status: error.status,
      details: error.details,
      message: error.message,
    });
    return;
  }

  console.error(action, error);
}

export function adminErrorMessage(error: unknown) {
  if (error instanceof SupabaseAdminError) {
    return error.message;
  }

  return error instanceof Error ? error.message : "Erreur inconnue.";
}

export { logSupabaseError };

export function sanitizeClientInput(input: Partial<ClientInput>): ClientInput {
  const rawStatus = String(input.status || "");
  const status = dossierStatuses.includes(rawStatus as ClientStatus)
    ? (rawStatus as ClientStatus)
    : legacyStatusMap[rawStatus] || "nouveau";
  const rawService = String(input.service || "").trim();
  const service = serviceTypes.includes(rawService as ServiceType) ? rawService : rawService || "autre";

  return {
    full_name: String(input.full_name || "").trim().slice(0, 180),
    email: String(input.email || "").trim().toLowerCase().slice(0, 254),
    phone: String(input.phone || "").trim().slice(0, 80) || undefined,
    country: String(input.country || "").trim().slice(0, 120) || undefined,
    service: service.slice(0, 160),
    status,
    file_reference: String(input.file_reference || "").trim().slice(0, 120) || undefined,
    notes: String(input.notes || "").trim().slice(0, 3000) || undefined,
    public_notes: String(input.public_notes || "").trim().slice(0, 3000) || undefined,
    internal_notes: String(input.internal_notes || "").trim().slice(0, 3000) || undefined,
    documents_received: Array.isArray(input.documents_received)
      ? input.documents_received.map((item) => String(item).trim()).filter(Boolean).slice(0, 60)
      : [],
    documents_missing: Array.isArray(input.documents_missing)
      ? input.documents_missing.map((item) => String(item).trim()).filter(Boolean).slice(0, 60)
      : [],
    action_history: Array.isArray(input.action_history)
      ? input.action_history
          .map((item) => ({ date: String(item.date || new Date().toISOString()), action: String(item.action || "").trim() }))
          .filter((item) => item.action)
          .slice(0, 100)
      : [],
    paid_amount: Number(input.paid_amount || 0),
  };
}

export function validateClientInput(input: ClientInput) {
  if (!input.full_name || !input.email || !input.service) {
    return "Le nom, l'e-mail et le service sont obligatoires.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    return "L'adresse e-mail du client est invalide.";
  }

  const paidAmount = Number(input.paid_amount || 0);

  if (Number.isNaN(paidAmount) || paidAmount < 0) {
    return "Le montant payé doit être positif.";
  }

  return null;
}

export async function listClients() {
  const { url, key, table } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/${table}?select=*&order=created_at.desc`, {
    headers: headers(key),
    cache: "no-store",
  });

  if (!response.ok) {
    throw await supabaseError("Liste clients", response);
  }

  return (await response.json()) as AdminClient[];
}

export async function getClient(id: string) {
  const { url, key, table } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&select=*&limit=1`, {
    headers: headers(key),
    cache: "no-store",
  });

  if (!response.ok) {
    throw await supabaseError("Lecture client", response);
  }

  const clients = (await response.json()) as AdminClient[];
  return clients[0] || null;
}

export async function createClient(input: ClientInput) {
  const { url, key, table } = supabaseConfig();

  async function insert(mode: "full" | "compatible") {
    return fetch(`${url}/rest/v1/${table}`, {
      method: "POST",
      headers: { ...headers(key), Prefer: "return=representation" },
      body: JSON.stringify(clientPayload(input, mode)),
    });
  }

  const response = await insert("full");
  if (response.ok) {
    return ((await response.json()) as AdminClient[])[0];
  }

  const error = await supabaseError("Création client", response);
  logSupabaseError("Erreur Supabase création client", error);

  if (!looksLikeMissingColumn(error)) {
    throw error;
  }

  const fallback = await insert("compatible");
  if (!fallback.ok) {
    throw await supabaseError("Création client compatible", fallback);
  }

  return ((await fallback.json()) as AdminClient[])[0];
}

export async function updateClient(id: string, input: ClientInput) {
  const { url, key, table } = supabaseConfig();

  async function update(mode: "full" | "compatible") {
    return fetch(`${url}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { ...headers(key), Prefer: "return=representation" },
      body: JSON.stringify(clientPayload(input, mode)),
    });
  }

  const response = await update("full");
  if (response.ok) {
    return ((await response.json()) as AdminClient[])[0];
  }

  const error = await supabaseError("Modification client", response);
  logSupabaseError("Erreur Supabase modification client", error);

  if (!looksLikeMissingColumn(error)) {
    throw error;
  }

  const fallback = await update("compatible");
  if (!fallback.ok) {
    throw await supabaseError("Modification client compatible", fallback);
  }

  return ((await fallback.json()) as AdminClient[])[0];
}

export async function deleteClient(id: string) {
  const { url, key, table } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: headers(key),
  });

  if (!response.ok) {
    throw await supabaseError("Suppression client", response);
  }
}

export function dashboardStats(clients: AdminClient[]) {
  const active = clients.filter((client) => ["en_attente", "incomplet", "en_traitement"].includes(client.status)).length;
  const payments = clients.filter((client) => Number(client.paid_amount) > 0).length;
  const revenue = clients.reduce((total, client) => total + Number(client.paid_amount || 0), 0);

  return {
    clients: clients.length,
    appointments: 0,
    active,
    payments,
    revenue,
  };
}
