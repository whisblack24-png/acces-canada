import { mkdirSync,writeFileSync } from "node:fs";
import { generateClientPdf } from "../lib/pdf-documents.ts";
const client={id:"11111111-2222-4333-8444-555555555555",file_reference:"AC-EXEMPLE-2026",full_name:"Client Exemple",email:"client.exemple@example.com",phone:"+1 555 0100",status:"active",service:"Visa visiteur",nationality:"Congolaise",country_of_residence:"Canada",address:"100, rue Exemple, Toronto",notes:"",internal_notes:"",created_at:new Date().toISOString(),updated_at:new Date().toISOString()} as never;
const metadata={documentNumber:"AC-EXEMPLE-2026-001",verificationToken:"11111111-2222-4333-8444-555555555555",authenticityHash:"A".repeat(64),version:1 as const,status:"active" as const,createdAt:new Date().toISOString(),digitallySigned:true};
mkdirSync("output/pdf",{recursive:true});
writeFileSync("output/pdf/exemple-convention-signatures.pdf",generateClientPdf(client,"convention",{includeSignatures:true},{},metadata));
writeFileSync("output/pdf/exemple-procuration-signatures.pdf",generateClientPdf(client,"procuration",{includeSignatures:true},{},metadata));
