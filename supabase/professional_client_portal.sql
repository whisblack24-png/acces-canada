-- Accès Canada - portail client et CRM professionnel.
-- Migration additive : aucune donnée existante n'est supprimée.

alter table public.admin_clients
  add column if not exists public_notes text;

alter table public.admin_clients drop constraint if exists admin_clients_status_check;
alter table public.admin_clients add constraint admin_clients_status_check check (
  status in ('nouveau', 'documents_recus', 'en_analyse', 'en_attente', 'depose', 'termine',
             'documents_en_attente', 'en_preparation', 'soumis', 'en_traitement', 'approuve', 'refuse')
);

create table if not exists public.client_document_signatures (
  id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), signed_at timestamptz,
  client_id uuid not null references public.admin_clients(id) on delete cascade,
  document_id uuid references public.admin_generated_documents(id) on delete set null,
  document_type text not null, document_label text not null, signer_name text not null, signer_email text not null,
  signature_text text, consent_text text, ip_address text, user_agent text,
  status text not null default 'pending' check (status in ('pending', 'signed', 'declined'))
);
create index if not exists client_document_signatures_client_id_idx on public.client_document_signatures(client_id);

create table if not exists public.client_payments (
  id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), paid_at timestamptz,
  client_id uuid not null references public.admin_clients(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0), currency text not null default 'usd', description text not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'cancelled')),
  stripe_session_id text unique, stripe_payment_intent text, checkout_url text
);
create index if not exists client_payments_client_id_idx on public.client_payments(client_id);

alter table public.client_uploaded_documents
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists category text not null default 'autre',
  add column if not exists version integer not null default 1,
  add column if not exists status text not null default 'active',
  add column if not exists replaced_document_id uuid references public.client_uploaded_documents(id) on delete set null,
  add column if not exists deleted_at timestamptz;
alter table public.client_uploaded_documents
  add column if not exists uploaded_by text not null default 'Client';
alter table public.client_uploaded_documents drop constraint if exists client_uploaded_documents_status_check;
alter table public.client_uploaded_documents add constraint client_uploaded_documents_status_check check (status in ('active', 'replaced', 'deleted'));
create index if not exists client_uploaded_documents_history_idx on public.client_uploaded_documents(client_id, created_at desc);

create table if not exists public.client_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_id uuid not null references public.admin_clients(id) on delete cascade,
  sender text not null check (sender in ('client', 'admin')),
  body text not null check (char_length(body) between 1 and 4000),
  read_at timestamptz
);
create index if not exists client_messages_client_created_idx on public.client_messages(client_id, created_at desc);
create index if not exists client_document_signatures_document_id_idx on public.client_document_signatures(document_id);
create index if not exists client_uploaded_documents_replaced_id_idx on public.client_uploaded_documents(replaced_document_id);

alter table public.client_document_signatures enable row level security;
alter table public.client_payments enable row level security;
alter table public.client_messages enable row level security;

revoke all on public.client_document_signatures, public.client_payments, public.client_messages from anon, authenticated;
grant all on public.client_document_signatures, public.client_payments, public.client_messages to service_role;

drop policy if exists "Service role can manage client login codes" on public.client_login_codes;
create policy "Service role can manage client login codes" on public.client_login_codes for all to service_role using (true) with check (true);
drop policy if exists "Service role can manage client uploaded documents" on public.client_uploaded_documents;
create policy "Service role can manage client uploaded documents" on public.client_uploaded_documents for all to service_role using (true) with check (true);
create policy "Service role can manage client signatures" on public.client_document_signatures for all to service_role using (true) with check (true);
create policy "Service role can manage client payments" on public.client_payments for all to service_role using (true) with check (true);
create policy "Service role can manage client messages" on public.client_messages for all to service_role using (true) with check (true);

drop policy if exists "Service role can manage admin clients" on public.admin_clients;
create policy "Service role can manage admin clients" on public.admin_clients for all to service_role using (true) with check (true);
drop policy if exists "Service role can manage generated documents" on public.admin_generated_documents;
create policy "Service role can manage generated documents" on public.admin_generated_documents for all to service_role using (true) with check (true);
create policy "Service role can manage client appointments" on public.client_appointments for all to service_role using (true) with check (true);
create policy "Service role can manage contact requests" on public.contact_requests for all to service_role using (true) with check (true);

alter function public.set_admin_clients_updated_at() set search_path = public, pg_temp;
alter function public.set_client_appointments_updated_at() set search_path = public, pg_temp;

notify pgrst, 'reload schema';
