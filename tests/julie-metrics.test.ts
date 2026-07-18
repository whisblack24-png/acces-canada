import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("le tableau IA couvre les métriques opérationnelles demandées",()=>{
  const metrics=readFileSync(new URL("../lib/julie-metrics.ts",import.meta.url),"utf8");
  const page=readFileSync(new URL("../app/admin/utilisation-ia/page.tsx",import.meta.url),"utf8");
  for(const field of ["documentsAnalyzed","documentsGenerated","pdfsCreated","wordsCreated","lettersGenerated","clientsProcessed","approvalsExecuted","averageProcessingMs","generatedToday","documentsCorrected","questionnairesCompleted","activeClients","inactiveClients","pendingTasks","timeSavedMinutes","estimatedSavingsCad","averageCostPerDossier","monthly","byClient"])assert.match(metrics,new RegExp(field));
  for(const label of ["Documents analysés","Documents générés","Générés aujourd’hui","Documents corrigés","PDF créés","Word créés","Lettres produites","Questionnaires remplis","Clients actifs","Clients inactifs","Tâches en attente","Temps économisé","Économies estimées","Coût moyen / dossier","Dossiers traités","Approbations exécutées","Activité des 14 derniers jours","Activité par client"])assert.match(page,new RegExp(label));
});
