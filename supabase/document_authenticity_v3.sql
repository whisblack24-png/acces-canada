begin;
create extension if not exists pgcrypto;
alter table if exists public.admin_generated_documents
  add column if not exists document_number text,
  add column if not exists verification_token uuid default gen_random_uuid(),
  add column if not exists authenticity_hash text,
  add column if not exists issued_at timestamptz default now(),
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancellation_reason text;
-- Des documents historiques peuvent référencer un client déjà supprimé. La clé
-- NOT VALID continue de contrôler les UPDATE ; on la recrée après le rattrapage
-- afin de préserver ces archives tout en protégeant les nouvelles écritures.
alter table if exists public.admin_generated_documents
  drop constraint if exists admin_generated_documents_client_id_fkey;
update public.admin_generated_documents set verification_token=coalesce(verification_token,gen_random_uuid()),issued_at=coalesce(issued_at,created_at,now()) where verification_token is null or issued_at is null;
update public.admin_generated_documents set document_number='AC-DOC-'||extract(year from coalesce(issued_at,created_at,now()))::int||'-'||upper(substr(replace(verification_token::text,'-',''),1,8)) where nullif(trim(document_number),'') is null;
update public.admin_generated_documents set authenticity_hash=encode(digest(document_number||'|'||client_id::text||'|'||document_type||'|'||issued_at::text,'sha256'),'hex') where nullif(trim(authenticity_hash),'') is null;
alter table if exists public.admin_generated_documents
  add constraint admin_generated_documents_client_id_fkey
  foreign key (client_id) references public.admin_clients(id) on delete cascade not valid;
create unique index if not exists admin_generated_documents_verification_token_uidx on public.admin_generated_documents(verification_token);
create unique index if not exists admin_generated_documents_document_number_uidx on public.admin_generated_documents(document_number);
create index if not exists admin_generated_documents_status_issued_idx on public.admin_generated_documents(status,issued_at desc);
alter table public.admin_generated_documents enable row level security;
revoke all on table public.admin_generated_documents from anon,authenticated;
grant select,insert,update,delete on table public.admin_generated_documents to service_role;
commit;
