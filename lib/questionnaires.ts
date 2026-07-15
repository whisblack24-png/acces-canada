import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { QuestionnaireType } from "./questionnaire-definitions.ts";
import { calculateQuestionnaireProgress, caseSteps } from "./questionnaire-definitions.ts";

export type QuestionnaireAnswers = Record<string, string | boolean>;
export type QuestionnaireRecord = { id: string; client_id: string; questionnaire_type: QuestionnaireType; status: "draft" | "submitted"; answers_encrypted: string; section_progress: Record<string, number>; progress_percent: number; respondent_name: string | null; respondent_email: string | null; created_at: string; updated_at: string; last_saved_at: string | null; submitted_at: string | null };
export type CaseStatus = "todo" | "in_progress" | "completed" | "not_applicable";
export type CaseProgress = { id: string; client_id: string; step_key: string; status: CaseStatus; admin_note: string | null; updated_at: string; updated_by: string | null };

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configuration Supabase manquante.");
  return { url, key };
}
function dbHeaders(prefer?: string) { const { key } = config(); return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(prefer ? { Prefer: prefer } : {}) }; }
async function checked(response: Response, action: string) { if (!response.ok) throw new Error(`${action}: ${await response.text()}`); return response; }
function encryptionKey() { const secret = process.env.QUESTIONNAIRE_ENCRYPTION_KEY || process.env.CLIENT_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET; if (!secret) throw new Error("QUESTIONNAIRE_ENCRYPTION_KEY manquante."); return createHash("sha256").update(secret).digest(); }

export function encryptAnswers(answers: QuestionnaireAnswers) {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(answers), "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}
export function decryptAnswers(payload: string): QuestionnaireAnswers {
  if (!payload) return {}; const [version, iv, tag, data] = payload.split("."); if (version !== "v1" || !iv || !tag || !data) throw new Error("Réponses chiffrées invalides.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url")); decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8")) as QuestionnaireAnswers;
}
export function createAccessToken() { const token = randomBytes(32).toString("base64url"); return { token, hash: hashAccessToken(token), prefix: token.slice(0, 8) }; }
export function hashAccessToken(token: string) { return createHash("sha256").update(token).digest("hex"); }

const SESSION_COOKIE = "acces_canada_questionnaire";
function sessionSecret() { return process.env.QUESTIONNAIRE_SESSION_SECRET || process.env.CLIENT_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET || ""; }
export function createQuestionnaireSession(questionnaireId: string, expiresAt: string) { const payload = Buffer.from(JSON.stringify({ questionnaireId, expiresAt }), "utf8").toString("base64url"); return `${payload}.${createHmac("sha256", sessionSecret()).update(payload).digest("hex")}`; }
export function verifyQuestionnaireSession(value?: string) { if (!value || !sessionSecret()) return null; const at = value.lastIndexOf("."); if (at < 1) return null; const payload = value.slice(0, at), signature = value.slice(at + 1), expected = createHmac("sha256", sessionSecret()).update(payload).digest("hex"); const a = Buffer.from(signature), b = Buffer.from(expected); if (a.length !== b.length || !timingSafeEqual(a, b)) return null; try { const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { questionnaireId: string; expiresAt: string }; return parsed.questionnaireId && new Date(parsed.expiresAt) > new Date() ? parsed : null; } catch { return null; } }
export { SESSION_COOKIE };

export async function listQuestionnaires(clientId: string) { const { url } = config(); const r = await checked(await fetch(`${url}/rest/v1/client_questionnaires?client_id=eq.${encodeURIComponent(clientId)}&select=*&order=questionnaire_type`, { headers: dbHeaders(), cache: "no-store" }), "Lecture questionnaires"); return (await r.json()) as QuestionnaireRecord[]; }
export async function getQuestionnaire(id: string) { const { url } = config(); const r = await checked(await fetch(`${url}/rest/v1/client_questionnaires?id=eq.${encodeURIComponent(id)}&select=*&limit=1`, { headers: dbHeaders(), cache: "no-store" }), "Lecture questionnaire"); return ((await r.json()) as QuestionnaireRecord[])[0] || null; }
export async function getClientQuestionnaire(clientId: string, type: QuestionnaireType) { const rows = await listQuestionnaires(clientId); return rows.find((row) => row.questionnaire_type === type) || null; }
export async function saveQuestionnaire(row: QuestionnaireRecord, answers: QuestionnaireAnswers, submit = false, respondent?: { name?: string; email?: string }) {
  const { url } = config(); const progress = calculateQuestionnaireProgress(row.questionnaire_type, answers); if (submit && progress < 100) throw new Error("Tous les champs obligatoires doivent être remplis avant la soumission."); const now = new Date().toISOString();
  const body = { answers_encrypted: encryptAnswers(answers), progress_percent: progress, status: submit ? "submitted" : row.status, last_saved_at: now, submitted_at: submit ? now : row.submitted_at, respondent_name: respondent?.name || row.respondent_name, respondent_email: respondent?.email || row.respondent_email };
  const r = await checked(await fetch(`${url}/rest/v1/client_questionnaires?id=eq.${row.id}`, { method: "PATCH", headers: dbHeaders("return=representation"), body: JSON.stringify(body) }), "Sauvegarde questionnaire"); const saved = ((await r.json()) as QuestionnaireRecord[])[0]; if (submit) await updateCaseProgress(row.client_id, row.questionnaire_type === "client_principal" ? "client_questionnaire" : "guarantor_questionnaire", "completed", "Soumission automatique", "questionnaire"); return saved;
}
export async function resolveAccessToken(token: string) { const { url } = config(); const hash = hashAccessToken(token); const r = await checked(await fetch(`${url}/rest/v1/questionnaire_access_links?token_hash=eq.${hash}&disabled_at=is.null&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=*&limit=1`, { headers: dbHeaders(), cache: "no-store" }), "Validation du lien"); const link = ((await r.json()) as { id: string; questionnaire_id: string; expires_at: string }[])[0]; if (!link) return null; await fetch(`${url}/rest/v1/questionnaire_access_links?id=eq.${link.id}`, { method: "PATCH", headers: dbHeaders(), body: JSON.stringify({ last_accessed_at: new Date().toISOString() }) }); return link; }
export async function generateAccessLink(questionnaireId: string, recipient: { name?: string; email?: string }, days = 14) { const { url } = config(); await fetch(`${url}/rest/v1/questionnaire_access_links?questionnaire_id=eq.${questionnaireId}&disabled_at=is.null`, { method: "PATCH", headers: dbHeaders(), body: JSON.stringify({ disabled_at: new Date().toISOString() }) }); const access = createAccessToken(); const expiresAt = new Date(Date.now() + Math.max(1, Math.min(days, 90)) * 86400000).toISOString(); const r = await checked(await fetch(`${url}/rest/v1/questionnaire_access_links`, { method: "POST", headers: dbHeaders("return=representation"), body: JSON.stringify({ questionnaire_id: questionnaireId, token_hash: access.hash, token_prefix: access.prefix, recipient_name: recipient.name || null, recipient_email: recipient.email || null, created_by: "administrateur", expires_at: expiresAt }) }), "Création du lien"); const link = ((await r.json()) as { id: string }[])[0]; return { ...link, token: access.token, expiresAt }; }
export async function disableAccessLinks(questionnaireId: string) { const { url } = config(); await checked(await fetch(`${url}/rest/v1/questionnaire_access_links?questionnaire_id=eq.${questionnaireId}&disabled_at=is.null`, { method: "PATCH", headers: dbHeaders(), body: JSON.stringify({ disabled_at: new Date().toISOString() }) }), "Désactivation du lien"); }
export async function listCaseProgress(clientId: string) { const { url } = config(); const r = await checked(await fetch(`${url}/rest/v1/client_case_progress?client_id=eq.${encodeURIComponent(clientId)}&select=*`, { headers: dbHeaders(), cache: "no-store" }), "Lecture progression"); const rows = (await r.json()) as CaseProgress[]; return caseSteps.map(([key]) => rows.find((row) => row.step_key === key)).filter((row): row is CaseProgress => Boolean(row)); }
export async function updateCaseProgress(clientId: string, stepKey: string, status: CaseStatus, note?: string, updatedBy = "administrateur") { const { url } = config(); const r = await checked(await fetch(`${url}/rest/v1/client_case_progress?client_id=eq.${clientId}&step_key=eq.${stepKey}`, { method: "PATCH", headers: dbHeaders("return=representation"), body: JSON.stringify({ status, admin_note: note || null, updated_at: new Date().toISOString(), updated_by: updatedBy }) }), "Mise à jour progression"); return ((await r.json()) as CaseProgress[])[0]; }
