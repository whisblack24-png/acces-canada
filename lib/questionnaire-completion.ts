import { createGeneratedDocument, listGeneratedDocumentsForClient } from "@/lib/admin-documents";
import { getClient } from "@/lib/admin-data";
import { documentFileName, type ClientDocumentType } from "@/lib/pdf-documents";
import type { QuestionnaireRecord } from "@/lib/questionnaires";

export async function ensureQuestionnaireCompletionDocuments(row: QuestionnaireRecord) {
  if (row.status !== "completed") return;
  const client = await getClient(row.client_id);
  if (!client) return;
  const expected: ClientDocumentType[] = row.questionnaire_type === "client_principal"
    ? ["checklist-visa", "lettre-explicative"]
    : ["lettre-soutien-financier"];
  const existing = await listGeneratedDocumentsForClient(client.id);
  for (const type of expected) {
    if (existing.some((document) => document.document_type === type)) continue;
    await createGeneratedDocument({ client_id: client.id, client_name: client.full_name, document_type: type, file_name: documentFileName(client, type), included_information: {} });
  }
}
