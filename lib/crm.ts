export type TimelineEvent = { id: string; client_id: string; event_type: string; title: string; description: string | null; source_table: string | null; source_id: string | null; metadata: Record<string, unknown>; created_at: string; created_by: string };
export type ClientTask = { id: string; client_id: string; title: string; description: string | null; priority: "low" | "normal" | "high" | "urgent"; status: "todo" | "in_progress" | "completed" | "cancelled"; due_at: string | null; assigned_to: string | null; completed_at: string | null; created_at: string; updated_at: string };
export type ClientReminder = { id: string; client_id: string; title: string; message: string; remind_at: string; channel: "admin" | "email"; status: "scheduled" | "sent" | "cancelled"; sent_at: string | null; created_at: string; updated_at: string };

function config() { const url = process.env.SUPABASE_URL?.replace(/\/$/, ""), key = process.env.SUPABASE_SERVICE_ROLE_KEY; if (!url || !key) throw new Error("Configuration Supabase CRM manquante."); return { url, key }; }
function headers(prefer?: string) { const { key } = config(); return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(prefer ? { Prefer: prefer } : {}) }; }
async function checked(response: Response, label: string) { if (!response.ok) throw new Error(`${label}: ${await response.text()}`); return response; }
async function rows<T>(table: string, query: string) { const { url } = config(); const response = await checked(await fetch(`${url}/rest/v1/${table}?${query}`, { headers: headers(), cache: "no-store" }), `Lecture ${table}`); return await response.json() as T[]; }

export const listTimeline = (clientId: string) => rows<TimelineEvent>("client_timeline_events", `client_id=eq.${encodeURIComponent(clientId)}&select=*&order=created_at.desc&limit=100`);
export const listClientTasks = (clientId: string) => rows<ClientTask>("client_tasks", `client_id=eq.${encodeURIComponent(clientId)}&select=*&order=created_at.desc`);
export const listClientReminders = (clientId: string) => rows<ClientReminder>("client_reminders", `client_id=eq.${encodeURIComponent(clientId)}&select=*&order=remind_at.asc`);
export const listAllTasks = () => rows<ClientTask>("client_tasks", "select=*&order=due_at.asc.nullslast");
export const listAllReminders = () => rows<ClientReminder>("client_reminders", "select=*&order=remind_at.asc");
export const listDueReminders = () => rows<ClientReminder>("client_reminders", `status=eq.scheduled&remind_at=lte.${encodeURIComponent(new Date().toISOString())}&select=*&order=remind_at.asc`);

export function buildCrmStats(tasks: ClientTask[], reminders: ClientReminder[], now = new Date()) {
  const timestamp = now.getTime();
  return {
    openTasks: tasks.filter((item) => !["completed", "cancelled"].includes(item.status)).length,
    overdueTasks: tasks.filter((item) => !["completed", "cancelled"].includes(item.status) && item.due_at && new Date(item.due_at).getTime() < timestamp).length,
    dueReminders: reminders.filter((item) => item.status === "scheduled" && new Date(item.remind_at).getTime() <= timestamp).length,
  };
}

async function insert<T>(table: string, body: Record<string, unknown>) { const { url } = config(); const response = await checked(await fetch(`${url}/rest/v1/${table}`, { method: "POST", headers: headers("return=representation"), body: JSON.stringify(body) }), `Création ${table}`); return (await response.json() as T[])[0]; }
async function patch<T>(table: string, id: string, body: Record<string, unknown>) { const { url } = config(); const response = await checked(await fetch(`${url}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: headers("return=representation"), body: JSON.stringify(body) }), `Modification ${table}`); return (await response.json() as T[])[0]; }

export const createTask = (clientId: string, input: { title: string; description?: string; priority?: ClientTask["priority"]; dueAt?: string; assignedTo?: string }) => insert<ClientTask>("client_tasks", { client_id: clientId, title: input.title, description: input.description || null, priority: input.priority || "normal", due_at: input.dueAt || null, assigned_to: input.assignedTo || null });
export const updateTask = (id: string, input: Partial<Pick<ClientTask, "status" | "priority" | "title" | "description" | "due_at" | "assigned_to">>) => patch<ClientTask>("client_tasks", id, { ...input, ...(input.status === "completed" ? { completed_at: new Date().toISOString() } : input.status ? { completed_at: null } : {}) });
export const createReminder = (clientId: string, input: { title: string; message: string; remindAt: string; channel?: ClientReminder["channel"] }) => insert<ClientReminder>("client_reminders", { client_id: clientId, title: input.title, message: input.message, remind_at: input.remindAt, channel: input.channel || "admin" });
export const updateReminder = (id: string, input: Partial<Pick<ClientReminder, "status" | "title" | "message" | "remind_at" | "channel">>) => patch<ClientReminder>("client_reminders", id, input);
export const markReminderSent = (id: string) => patch<ClientReminder>("client_reminders", id, { status: "sent", sent_at: new Date().toISOString() });

export async function addTimelineEvent(clientId: string, title: string, description: string, createdBy = "administrateur") { return insert<TimelineEvent>("client_timeline_events", { client_id: clientId, event_type: "administratif", title, description, created_by: createdBy }); }
