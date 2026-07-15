import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { QuestionnaireForm } from "@/components/questionnaire/QuestionnaireForm";
import { decryptAnswers, getQuestionnaire, SESSION_COOKIE, verifyQuestionnaireSession } from "@/lib/questionnaires";

export default async function QuestionnairePage() { const store = await cookies(); const session = verifyQuestionnaireSession(store.get(SESSION_COOKIE)?.value); if (!session) redirect("/questionnaire/lien-invalide"); const questionnaire = await getQuestionnaire(session.questionnaireId); if (!questionnaire) redirect("/questionnaire/lien-invalide"); return <main className="min-h-screen bg-ivory px-4 py-8 sm:px-6"><div className="mx-auto max-w-7xl"><p className="mb-5 text-center text-sm font-bold text-navy/55">Accès sécurisé · Vos réponses sont chiffrées et sauvegardées automatiquement.</p><QuestionnaireForm type={questionnaire.questionnaire_type} initialAnswers={decryptAnswers(questionnaire.answers_encrypted)} initialStatus={questionnaire.status} /></div></main>; }

