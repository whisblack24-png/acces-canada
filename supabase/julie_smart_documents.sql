begin;

create table if not exists public.julie_smart_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.admin_clients(id) on delete cascade,
  parent_document_id uuid references public.julie_smart_documents(id) on delete set null,
  title text not null,
  category text not null,
  document_kind text not null check (document_kind in ('contrat','lettre','formulaire','questionnaire','checklist','procedure','modele','autre')),
  source_text text not null,
  professional_text text not null,
  edit_instruction text,
  version integer not null default 1 check (version > 0),
  word_upload_id uuid references public.client_uploaded_documents(id) on delete set null,
  pdf_upload_id uuid references public.client_uploaded_documents(id) on delete set null,
  model text,
  created_by text not null default 'julie',
  created_at timestamptz not null default now()
);

create index if not exists julie_smart_documents_client_idx
  on public.julie_smart_documents(client_id, created_at desc);
create index if not exists julie_smart_documents_parent_idx
  on public.julie_smart_documents(parent_document_id, version desc);
create index if not exists julie_smart_documents_word_upload_idx
  on public.julie_smart_documents(word_upload_id) where word_upload_id is not null;
create index if not exists julie_smart_documents_pdf_upload_idx
  on public.julie_smart_documents(pdf_upload_id) where pdf_upload_id is not null;

alter table public.julie_smart_documents enable row level security;
revoke all on public.julie_smart_documents from anon, authenticated;
grant all on public.julie_smart_documents to service_role;
drop policy if exists service_role_julie_smart_documents on public.julie_smart_documents;
create policy service_role_julie_smart_documents on public.julie_smart_documents
  for all to service_role using (true) with check (true);

commit;
