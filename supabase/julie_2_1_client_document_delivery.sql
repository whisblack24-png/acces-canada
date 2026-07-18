alter table public.client_uploaded_documents
  add column if not exists visible_to_client boolean not null default false,
  add column if not exists portal_summary text,
  add column if not exists portal_actions jsonb not null default '[]'::jsonb,
  add column if not exists portal_deadline timestamptz,
  add column if not exists shared_at timestamptz,
  add column if not exists viewed_at timestamptz;

create index if not exists client_uploaded_documents_portal_idx
  on public.client_uploaded_documents(client_id,shared_at desc)
  where status='active' and visible_to_client=true;

alter table public.client_uploaded_documents enable row level security;
revoke all on public.client_uploaded_documents from anon,authenticated;
grant all on public.client_uploaded_documents to service_role;
