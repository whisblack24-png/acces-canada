-- Accès Canada - historique des documents générés
-- A executer dans Supabase SQL Editor pour activer le module /admin/documents.

create table if not exists public.admin_generated_documents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_id uuid not null,
  client_name text not null,
  document_type text not null,
  document_label text not null,
  file_name text not null,
  included_information jsonb not null default '{}'::jsonb
);

alter table public.admin_generated_documents
  drop constraint if exists admin_generated_documents_type_check;

alter table public.admin_generated_documents
  add constraint admin_generated_documents_type_check
  check (
    document_type in (
      'convention',
      'reconnaissance-dette',
      'checklist-visa',
      'facture',
      'lettre-explicative',
      'lettre-soutien-financier',
      'lettre-invitation',
      'recu-paiement'
    )
  );

create index if not exists admin_generated_documents_created_at_idx
  on public.admin_generated_documents (created_at desc);

create index if not exists admin_generated_documents_client_id_idx
  on public.admin_generated_documents (client_id);

alter table public.admin_generated_documents enable row level security;

drop policy if exists "Service role can manage generated documents" on public.admin_generated_documents;

create policy "Service role can manage generated documents"
  on public.admin_generated_documents
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

notify pgrst, 'reload schema';
