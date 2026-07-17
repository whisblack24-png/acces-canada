begin;

create table if not exists public.document_signature_settings (
  signer_key text primary key check (signer_key in ('director','legal_counsel')),
  display_name text not null,
  job_title text not null,
  enabled boolean not null default true,
  storage_path text,
  vector_data jsonb,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.document_signature_settings enable row level security;
revoke all on public.document_signature_settings from anon, authenticated;
grant all on public.document_signature_settings to service_role;
drop policy if exists service_role_document_signature_settings on public.document_signature_settings;
create policy service_role_document_signature_settings on public.document_signature_settings
  for all to service_role using (true) with check (true);

insert into public.document_signature_settings (signer_key,display_name,job_title,enabled)
values
  ('director','Christian Nkuli Mboyo','Directeur général',true),
  ('legal_counsel','Me Régine Sifa Buledi','Conseillère juridique',true)
on conflict (signer_key) do nothing;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('document-signatures','document-signatures',false,3145728,array['image/png'])
on conflict (id) do update set public=false,file_size_limit=3145728,allowed_mime_types=array['image/png'];

commit;
