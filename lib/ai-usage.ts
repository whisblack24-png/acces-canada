import "server-only";

export type AiUsageEvent = {
  id: string; conversation_id: string | null; client_id: string | null; feature: string; model: string;
  input_tokens: number; output_tokens: number; estimated_cost_usd: number; status: "completed" | "failed" | "quota_exceeded";
  error_code: string | null; created_at: string;
};

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, ""), key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configuration Supabase IA manquante.");
  return { url, key };
}
function headers(prefer?: string) { const { key } = config(); return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(prefer ? { Prefer: prefer } : {}) }; }

export async function recordAiUsage(input: { conversationId?: string; clientId?: string; feature: string; model: string; inputTokens?: number; outputTokens?: number; status?: AiUsageEvent["status"]; errorCode?: string }) {
  const { url } = config();
  const inputTokens = Math.max(0, input.inputTokens || 0), outputTokens = Math.max(0, input.outputTokens || 0);
  const inputRate = Math.max(0, Number(process.env.OPENAI_INPUT_COST_PER_MILLION_USD) || 0), outputRate = Math.max(0, Number(process.env.OPENAI_OUTPUT_COST_PER_MILLION_USD) || 0);
  await fetch(`${url}/rest/v1/julie_ai_usage_events`, { method: "POST", headers: headers(), body: JSON.stringify({ conversation_id: input.conversationId || null, client_id: input.clientId || null, feature: input.feature, model: input.model, input_tokens: inputTokens, output_tokens: outputTokens, estimated_cost_usd: inputTokens / 1_000_000 * inputRate + outputTokens / 1_000_000 * outputRate, status: input.status || "completed", error_code: input.errorCode || null }) });
}

export async function listAiUsage(limit = 250) {
  const { url } = config();
  const response = await fetch(`${url}/rest/v1/julie_ai_usage_events?select=*&order=created_at.desc&limit=${Math.min(1000, Math.max(1, limit))}`, { headers: headers(), cache: "no-store" });
  if (!response.ok) throw new Error("Utilisation IA indisponible.");
  return await response.json() as AiUsageEvent[];
}

export function summarizeAiUsage(events: AiUsageEvent[], now = new Date()) {
  const day = now.toISOString().slice(0, 10), month = day.slice(0, 7);
  const total = (rows: AiUsageEvent[]) => ({ requests: rows.length, inputTokens: rows.reduce((sum, row) => sum + row.input_tokens, 0), outputTokens: rows.reduce((sum, row) => sum + row.output_tokens, 0), estimatedCostUsd: rows.reduce((sum, row) => sum + Number(row.estimated_cost_usd || 0), 0) });
  return { today: total(events.filter((row) => row.created_at.startsWith(day))), month: total(events.filter((row) => row.created_at.startsWith(month))), all: total(events), quotaErrors: events.filter((row) => row.status === "quota_exceeded").length };
}

export async function assertMonthlyAiBudget() {
  const limit = Math.max(0, Number(process.env.JULIE_MONTHLY_TOKEN_LIMIT) || 0);
  if (!limit) return;
  const events = await listAiUsage(1000), summary = summarizeAiUsage(events);
  if (summary.month.inputTokens + summary.month.outputTokens >= limit) throw new Error("LIMITE_MENSUELLE_IA_ATTEINTE");
}
