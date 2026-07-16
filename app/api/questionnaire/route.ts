import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getQuestionnaire, saveQuestionnaire, SESSION_COOKIE, verifyQuestionnaireSession, type QuestionnaireAnswers } from "@/lib/questionnaires";
import { ensureQuestionnaireCompletionDocuments } from "@/lib/questionnaire-completion";

export async function PATCH(request: Request) {
  const store = await cookies(); const session = verifyQuestionnaireSession(store.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Session expirée." }, { status: 401 });
  const row = await getQuestionnaire(session.questionnaireId);
  if (!row) return NextResponse.json({ error: "Questionnaire introuvable." }, { status: 404 });
  if (row.status === "completed") return NextResponse.json({ error: "Ce questionnaire est déjà complété. Contactez Accès Canada pour une correction." }, { status: 409 });
  try { const body = await request.json() as { answers?: QuestionnaireAnswers; submit?: boolean }; const saved = await saveQuestionnaire(row, body.answers || {}, body.submit === true); await ensureQuestionnaireCompletionDocuments(saved).catch((error) => console.error("Génération automatique des documents:", error)); return NextResponse.json({ ok: true, progress: saved.progress_percent, status: saved.status }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur de sauvegarde." }, { status: 400 }); }
}
