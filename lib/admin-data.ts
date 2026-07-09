export type ClientStatus = "prospect" | "active" | "waiting" | "approved" | "closed";

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
  paid_amount?: number;
};

const statuses: ClientStatus[] = ["prospect", "active", "waiting", "approved", "closed"];

function supabaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const table = process.env.SUPABASE_CLIENTS_TABLE || "admin_clients";

  if (!url || !key) {
    throw new Error("Configuration Supabase manquante pour l'espace admin.");
  }

  return { url, key, table };
}

function headers(key: string) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export function sanitizeClientInput(input: Partial<ClientInput>): ClientInput {
  const status = statuses.includes(input.status as ClientStatus) ? (input.status as ClientStatus) : "prospect";

  return {
    full_name: String(input.full_name || "").trim().slice(0, 180),
    email: String(input.email || "").trim().toLowerCase().slice(0, 254),
    phone: String(input.phone || "").trim().slice(0, 80) || undefined,
    country: String(input.country || "").trim().slice(0, 120) || undefined,
    service: String(input.service || "").trim().slice(0, 160),
    status,
    file_reference: String(input.file_reference || "").trim().slice(0, 120) || undefined,
    notes: String(input.notes || "").trim().slice(0, 3000) || undefined,
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
    throw new Error(await response.text());
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
    throw new Error(await response.text());
  }

  const clients = (await response.json()) as AdminClient[];
  return clients[0] || null;
}

export async function createClient(input: ClientInput) {
  const { url, key, table } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...headers(key), Prefer: "return=representation" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return ((await response.json()) as AdminClient[])[0];
}

export async function updateClient(id: string, input: ClientInput) {
  const { url, key, table } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { ...headers(key), Prefer: "return=representation" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return ((await response.json()) as AdminClient[])[0];
}

export async function deleteClient(id: string) {
  const { url, key, table } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: headers(key),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }
}

export function dashboardStats(clients: AdminClient[]) {
  const active = clients.filter((client) => ["active", "waiting"].includes(client.status)).length;
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
