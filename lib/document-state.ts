import "server-only";
import { getClient, updateClient } from "@/lib/admin-data";
import { listClientUploads } from "@/lib/client-portal";

const required:Record<string,Array<{category:string;label:string}>>={
  visa_visiteur:[{category:"passeport",label:"Passeport"},{category:"situation_financiere",label:"Preuve financière"},{category:"emploi_commerce",label:"Preuve d’emploi ou de commerce"},{category:"attaches_familiales",label:"Attaches familiales"}],
  permis_etudes:[{category:"passeport",label:"Passeport"},{category:"situation_financiere",label:"Preuve financière"},{category:"emploi_commerce",label:"Diplômes et relevés"}],
  permis_travail:[{category:"passeport",label:"Passeport"},{category:"emploi_commerce",label:"Offre d’emploi et expérience"},{category:"situation_financiere",label:"Preuve financière"}],
  residence_permanente:[{category:"passeport",label:"Passeport"},{category:"identite",label:"État civil"},{category:"emploi_commerce",label:"Diplômes et expérience professionnelle"}],
  autre:[{category:"passeport",label:"Passeport"},{category:"identite",label:"Pièce d’identité"},{category:"situation_financiere",label:"Preuve financière"}],
};

const labels:Record<string,string>={a_verifier:"Document à vérifier",identite:"Identité et état civil",passeport:"Passeport",refus_ircc:"Refus IRCC",formulaires_ircc:"Formulaires IRCC",situation_financiere:"Situation financière du client",emploi_commerce:"Emploi ou commerce",attaches_familiales:"Attaches familiales",garant_financier:"Documents du garant financier",correspondance:"Correspondance",acces_canada:"Documents générés par Accès Canada"};

export async function reconcileClientDocumentState(clientId:string){
  const [client,uploads]=await Promise.all([getClient(clientId),listClientUploads(clientId,true)]);
  if(!client)return null;
  const active=uploads.filter((document)=>document.status==="active");
  const categories=new Set(active.map((document)=>document.category));
  const received=[...new Set(active.map((document)=>labels[document.category]||document.category))];
  const expected=required[client.service]||required.autre;
  const missing=expected.filter((item)=>!categories.has(item.category)).map((item)=>item.label);
  const history=[...(client.action_history||[]),{date:new Date().toISOString(),action:`État documentaire recalculé : ${received.length} catégorie(s) reçue(s), ${missing.length} manquante(s).`}].slice(-100);
  await updateClient(client.id,{full_name:client.full_name,email:client.email,phone:client.phone||undefined,country:client.country||undefined,service:client.service,status:active.length&&client.status==="nouveau"?"documents_recus":client.status,file_reference:client.file_reference||undefined,notes:client.notes||undefined,public_notes:client.public_notes||undefined,internal_notes:client.internal_notes||undefined,documents_received:received,documents_missing:missing,action_history:history,paid_amount:client.paid_amount});
  return {received,missing,toReview:active.filter((item)=>item.category==="a_verifier").length,guarantorDocuments:active.filter((item)=>item.category==="garant_financier").length};
}
