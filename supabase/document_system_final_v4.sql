begin;

alter table if exists public.admin_generated_documents
  drop constraint if exists admin_generated_documents_type_check;
alter table if exists public.admin_generated_documents
  add constraint admin_generated_documents_type_check check (document_type in (
    'convention','reconnaissance-dette','checklist-visa','facture',
    'lettre-explicative','lettre-soutien-financier','lettre-invitation',
    'recu-paiement','procuration','lettre-autorisation'
  )) not valid;
alter table if exists public.admin_generated_documents
  validate constraint admin_generated_documents_type_check;

alter table if exists public.internal_document_library
  add column if not exists is_favorite boolean not null default false,
  add column if not exists version integer not null default 1 check (version > 0),
  add column if not exists parent_template_id uuid,
  add column if not exists archived_at timestamptz;

do $$ begin
  if to_regclass('public.internal_document_library') is not null
     and not exists (select 1 from pg_constraint where conname='internal_document_library_parent_template_fkey') then
    alter table public.internal_document_library
      add constraint internal_document_library_parent_template_fkey
      foreign key (parent_template_id) references public.internal_document_library(id) on delete set null not valid;
  end if;
end $$;

create index if not exists internal_document_library_search_idx on public.internal_document_library(status,is_favorite,updated_at desc);
create index if not exists internal_document_library_parent_idx on public.internal_document_library(parent_template_id,version desc);
alter table if exists public.internal_document_library enable row level security;
revoke all on table public.internal_document_library from anon,authenticated;
grant select,insert,update,delete on table public.internal_document_library to service_role;
notify pgrst, 'reload schema';
commit;
