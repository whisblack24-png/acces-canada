export type AdminNotification = { id:string; client_id:string|null; notification_type:string; title:string; message:string; severity:"info"|"success"|"warning"|"urgent"; href:string|null; status:"unread"|"read"|"dismissed"; dedupe_key:string|null; created_at:string; read_at:string|null };
export type AuditLog = { id:string; actor_id:string; actor_type:"system"|"staff"|"client"|"public"; action:string; entity_type:string; entity_id:string|null; client_id:string|null; summary:string; metadata:Record<string,unknown>; ip_address:string|null; user_agent:string|null; created_at:string };
export type UniversalSearchResult = { id:string; type:"Client"|"Dossier"|"Document"|"Facture"|"Paiement"|"Rendez-vous"; title:string; subtitle:string; href:string };

function config(){const url=process.env.SUPABASE_URL?.replace(/\/$/,"");const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error("Configuration Supabase V2 manquante.");return{url,key};}
function headers(prefer?:string){const{key}=config();return{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json",...(prefer?{Prefer:prefer}:{})};}
async function checked(response:Response,label:string){if(!response.ok)throw new Error(`${label}: ${await response.text()}`);return response;}
async function rows<T>(table:string,query:string){const{url}=config();const response=await checked(await fetch(`${url}/rest/v1/${table}?${query}`,{headers:headers(),cache:"no-store"}),`Lecture ${table}`);return await response.json() as T[];}

export const listAdminNotifications=(limit=50)=>rows<AdminNotification>("admin_notifications",`select=*&order=created_at.desc&limit=${limit}`);
export const listUnreadNotifications=()=>rows<AdminNotification>("admin_notifications","status=eq.unread&select=*&order=created_at.desc&limit=50");
export const listAuditLogs=(limit=200)=>rows<AuditLog>("audit_logs",`select=*&order=created_at.desc&limit=${limit}`);

export async function updateNotification(id:string,status:AdminNotification["status"]){const{url}=config();const response=await checked(await fetch(`${url}/rest/v1/admin_notifications?id=eq.${encodeURIComponent(id)}`,{method:"PATCH",headers:headers("return=representation"),body:JSON.stringify({status,read_at:status==="read"?new Date().toISOString():null})}),"Mise à jour notification");return (await response.json() as AdminNotification[])[0];}
export async function markAllNotificationsRead(){const{url}=config();await checked(await fetch(`${url}/rest/v1/admin_notifications?status=eq.unread`,{method:"PATCH",headers:headers(),body:JSON.stringify({status:"read",read_at:new Date().toISOString()})}),"Lecture notifications");}
export async function createNotification(input:{clientId?:string;type:string;title:string;message:string;severity?:AdminNotification["severity"];href?:string;dedupeKey?:string}){const{url}=config();const response=await checked(await fetch(`${url}/rest/v1/admin_notifications`,{method:"POST",headers:headers("resolution=ignore-duplicates,return=representation"),body:JSON.stringify({client_id:input.clientId||null,notification_type:input.type,title:input.title,message:input.message,severity:input.severity||"info",href:input.href||null,dedupe_key:input.dedupeKey||null})}),"Création notification");return (await response.json() as AdminNotification[])[0]||null;}
export async function createAuditLog(input:{actorId?:string;actorType?:AuditLog["actor_type"];action:string;entityType:string;entityId?:string;clientId?:string;summary:string;metadata?:Record<string,unknown>;ipAddress?:string;userAgent?:string}){const{url}=config();await checked(await fetch(`${url}/rest/v1/audit_logs`,{method:"POST",headers:headers(),body:JSON.stringify({actor_id:input.actorId||"administrateur",actor_type:input.actorType||"staff",action:input.action,entity_type:input.entityType,entity_id:input.entityId||null,client_id:input.clientId||null,summary:input.summary,metadata:input.metadata||{},ip_address:input.ipAddress||null,user_agent:input.userAgent||null})}),"Journalisation");}

export function cleanSearch(value:string){return value.trim().replace(/[%*(),.]/g," ").replace(/\s+/g," ").trim().slice(0,80);}
async function searchRows<T>(table:string,columns:string[],term:string,select:string){const pattern=`*${term}*`;const filters=columns.map((column)=>`${column}.ilike.${pattern}`).join(",");return rows<T>(table,`or=(${encodeURIComponent(filters)})&select=${select}&limit=6`);}
export async function universalSearch(rawQuery:string):Promise<UniversalSearchResult[]>{const query=cleanSearch(rawQuery);if(query.length<2)return[];const [clients,uploads,documents,payments,appointments]=await Promise.all([
  searchRows<{id:string;full_name:string;email:string;file_reference:string|null}>("admin_clients",["full_name","email","file_reference"],query,"id,full_name,email,file_reference"),
  searchRows<{id:string;client_id:string;file_name:string;category:string}>("client_uploaded_documents",["file_name","category"],query,"id,client_id,file_name,category"),
  searchRows<{id:string;client_id:string;document_label:string;file_name:string;client_name:string}>("admin_generated_documents",["document_label","file_name","client_name"],query,"id,client_id,document_label,file_name,client_name"),
  searchRows<{id:string;client_id:string;description:string;status:string;stripe_session_id:string|null}>("client_payments",["description","stripe_session_id"],query,"id,client_id,description,status,stripe_session_id"),
  searchRows<{id:string;client_email:string;client_full_name:string;booking_reference:string;invoice_number:string}>("client_appointments",["client_full_name","client_email","booking_reference","invoice_number"],query,"id,client_email,client_full_name,booking_reference,invoice_number"),
 ]);
 const clientByEmail=new Map((await rows<{id:string;email:string}>("admin_clients","select=id,email&limit=1000")).map((item)=>[item.email.toLowerCase(),item.id]));
 return [
  ...clients.map((item)=>({id:`client-${item.id}`,type:"Client" as const,title:item.full_name,subtitle:item.file_reference||item.email,href:`/admin/clients/${item.id}`})),
  ...uploads.map((item)=>({id:`upload-${item.id}`,type:"Document" as const,title:item.file_name,subtitle:item.category,href:`/admin/clients/${item.client_id}`})),
  ...documents.map((item)=>({id:`document-${item.id}`,type:(item.document_label.toLowerCase().includes("facture")?"Facture":"Document") as "Facture"|"Document",title:item.document_label,subtitle:item.client_name,href:`/admin/clients/${item.client_id}`})),
  ...payments.map((item)=>({id:`payment-${item.id}`,type:"Paiement" as const,title:item.description,subtitle:item.status,href:`/admin/clients/${item.client_id}`})),
  ...appointments.map((item)=>({id:`appointment-${item.id}`,type:"Rendez-vous" as const,title:item.booking_reference,subtitle:`${item.client_full_name} · ${item.invoice_number}`,href:clientByEmail.get(item.client_email.toLowerCase())?`/admin/clients/${clientByEmail.get(item.client_email.toLowerCase())}`:"/admin/rendez-vous"})),
 ].slice(0,20);
}
