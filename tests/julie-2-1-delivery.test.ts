import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");

test("chaque téléchargement vérifie le contenu et impose des en-têtes sûrs",()=>{
  const helper=read("lib/file-download.ts");
  for(const marker of ["%PDF-","%%EOF","[Content_Types].xml","word/document.xml","filename*=UTF-8''","X-Content-Type-Options","Content-Length"])assert.match(helper,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  for(const route of ["app/api/admin/client-uploads/[id]/download/route.ts","app/api/client/uploads/[id]/download/route.ts","app/api/admin/documents/[id]/download/route.ts","app/api/client/generated-documents/[id]/download/route.ts"]){const source=read(route);assert.match(source,/assertDownloadableFile/);assert.match(source,/downloadHeaders/);}
});

test("un document peut être envoyé au portail avec résumé, actions, échéance et notification",()=>{
  const migration=read("supabase/julie_2_1_client_document_delivery.sql"),route=read("app/api/admin/client-uploads/[id]/share/route.ts"),portal=read("app/client/documents/page.tsx"),admin=read("components/admin/ClientUploadedDocumentsAdmin.tsx");
  for(const field of ["visible_to_client","portal_summary","portal_actions","portal_deadline","shared_at","viewed_at"])assert.match(migration,new RegExp(field));
  assert.match(route,/prepareClientDocumentDelivery/);assert.match(route,/notifyClient/);assert.match(route,/createAuditLog/);assert.match(admin,/Envoyer au client/);assert.match(portal,/Actions demandées/);assert.match(portal,/Date limite/);
});

test("le QR utilise une zone calme standard et une correction renforcée",()=>{
  const branding=read("lib/document-branding.ts");assert.match(branding,/errorCorrectionLevel:"Q"/);assert.match(branding,/quiet=4/);assert.match(branding,/qrCodeCommands\(url,pageWidth-78,6,54\)/);
});
