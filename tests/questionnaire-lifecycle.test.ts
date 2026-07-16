import assert from "node:assert/strict";
import test from "node:test";
import { calculateQuestionnaireProgress, questionnaireDefinitions, questionnaireLifecycleStatus } from "../lib/questionnaire-definitions.ts";

test("le cycle de vie suit la progression réelle", () => {
  const fields = questionnaireDefinitions.garant_financier.flatMap((section) => section.fields);
  const answers: Record<string, string | boolean> = {};
  assert.equal(questionnaireLifecycleStatus("garant_financier", answers), "draft");
  answers[fields[0].key] = "réponse";
  assert.equal(questionnaireLifecycleStatus("garant_financier", answers), "in_progress");
  assert.ok(calculateQuestionnaireProgress("garant_financier", answers) > 0);
  assert.ok(calculateQuestionnaireProgress("garant_financier", answers) < 100);
  for (const field of fields) answers[field.key] = field.type === "checkbox" ? true : "réponse";
  assert.equal(calculateQuestionnaireProgress("garant_financier", answers), 100);
  assert.equal(questionnaireLifecycleStatus("garant_financier", answers), "completed");
});
