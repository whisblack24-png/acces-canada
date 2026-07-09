-- Acces Canada - Portail client securise
-- A executer dans Supabase SQL Editor avant d'utiliser /client/login.

alter table public.admin_clients
  add column if not exists public_notes text;

create table if not exists public.client_login_codes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_id uuid not null,
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz
);

create index if not exists client_login_codes_email_idx
  on public.client_login_codes (email);

create index if not exists client_login_codes_client_id_idx
  on public.client_login_codes (client_id);

create index if not exists client_login_codes_expires_at_idx
  on public.client_login_codes (expires_at);

alter table public.client_login_codes enable row level security;

drop policy if exists "Service role can manage client login codes" on public.client_login_codes;

create policy "Service role can manage client login codes"
  on public.client_login_codes
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create table if not exists public.client_uploaded_documents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_id uuid not null,
  file_name text not null,
  file_path text not null,
  file_type text,
  file_size bigint
);

alter table public.client_uploaded_documents
  drop constraint if exists client_uploaded_documents_type_check;

alter table public.client_uploaded_documents
  add constraint client_uploaded_documents_type_check
  check (file_type is null or file_type in ('application/pdf', 'image/jpeg', 'image/png'));

create index if not exists client_uploaded_documents_client_id_idx
  on public.client_uploaded_documents (client_id);

create index if not exists client_uploaded_documents_created_at_idx
  on public.client_uploaded_documents (created_at desc);

alter table public.client_uploaded_documents enable row level security;

drop policy if exists "Service role can manage client uploaded documents" on public.client_uploaded_documents;

create policy "Service role can manage client uploaded documents"
  on public.client_uploaded_documents
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-documents',
  'client-documents',
  false,
  8388608,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

notify pgrst, 'reload schema';
