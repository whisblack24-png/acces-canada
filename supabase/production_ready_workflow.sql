-- Accès Canada - production: signatures électroniques, paiements et statuts CRM.
-- À exécuter dans Supabase SQL Editor avant le déploiement Vercel de cette phase.

alter table public.admin_clients
  drop constraint if exists admin_clients_status_check;

update public.admin_clients
set status = case status
  when 'documents_en_attente' then 'en_attente'
  when 'en_preparation' then 'en_analyse'
  when 'soumis' then 'depose'
  when 'en_traitement' then 'en_analyse'
  when 'approuve' then 'termine'
  when 'refuse' then 'termine'
  else status
end
where status in ('documents_en_attente', 'en_preparation', 'soumis', 'en_traitement', 'approuve', 'refuse');

alter table public.admin_clients
  add constraint admin_clients_status_check
  check (status in ('nouveau', 'documents_recus', 'en_analyse', 'en_attente', 'depose', 'termine'));

create table if not exists public.client_document_signatures (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  signed_at timestamptz,
  client_id uuid not null references public.admin_clients(id) on delete cascade,
  document_id uuid references public.admin_generated_documents(id) on delete set null,
  document_type text not null,
  document_label text not null,
  signer_name text not null,
  signer_email text not null,
  signature_text text,
  consent_text text,
  ip_address text,
  user_agent text,
  status text not null default 'pending'
    check (status in ('pending', 'signed', 'declined'))
);

create index if not exists client_document_signatures_client_id_idx
  on public.client_document_signatures(client_id);

create table if not exists public.client_payments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  client_id uuid not null references public.admin_clients(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'usd',
  description text not null,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'cancelled')),
  stripe_session_id text unique,
  stripe_payment_intent text,
  checkout_url text
);

create index if not exists client_payments_client_id_idx
  on public.client_payments(client_id);

notify pgrst, 'reload schema';
