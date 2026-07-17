import test from "node:test";
import assert from "node:assert/strict";
import { clientTemplateVariables, replaceTemplateVariables } from "../lib/template-variables.ts";

test("remplace automatiquement les variables connues du dossier client", () => {
  const variables = clientTemplateVariables({ id:"1", created_at:"2026-01-01", full_name:"Christian Nkuli Mboyo", email:"c@example.com", phone:"514", country:"Canada", service:"visa_visiteur", status:"en_analyse", file_reference:"AC-24", notes:null, public_notes:null, internal_notes:null, documents_received:[], documents_missing:[], action_history:[], paid_amount:100 } as never, new Date("2026-07-17T12:00:00Z"));
  const result = replaceTemplateVariables("Client: {{client_nom}} — dossier {{numero_dossier}} — {{variable_absente}}", variables);
  assert.equal(result.content, "Client: Christian Nkuli Mboyo — dossier AC-24 — [À COMPLÉTER : variable absente]");
  assert.deepEqual(result.missing, ["variable_absente"]);
});
