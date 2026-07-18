import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("le tableau IA couvre les métriques opérationnelles demandées",()=>{
  const metrics=readFileSync(new URL("../lib/julie-metrics.ts",import.meta.url),"utf8");
  const page=readFileSync(new URL("../app/admin/utilisation-ia/page.tsx",import.meta.url),"utf8");
  for(const field of ["documentsAnalyzed","documentsGenerated","pdfsCreated","wordsCreated","lettersGenerated","clientsProcessed","approvalsExecuted","averageProcessingMs","byClient"])assert.match(metrics,new RegExp(field));
  for(const label of ["Documents analysés","Documents générés","PDF créés","Word créés","Lettres générées","Dossiers traités","Approbations exécutées","Activité des 14 derniers jours","Activité par client"])assert.match(page,new RegExp(label));
});
