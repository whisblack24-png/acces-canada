-- Correctif non destructif pour aligner les tables Supabase existantes
-- avec le code actuel d'Accès Canada.
-- À exécuter dans Supabase > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.contact_requests (
  id uuid primary key default gen_random_uuid()
);

alter table public.contact_requests
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists full_name text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists service text,
  add column if not exists country text,
  add column if not exists preferred_date text,
  add column if not exists message text,
  add column if not exists status text not null default 'new',
  add column if not exists source text not null default 'website';

update public.contact_requests
set
  full_name = coalesce(full_name, ''),
  email = coalesce(email, ''),
  service = coalesce(service, ''),
  message = coalesce(message, '')
where full_name is null
   or email is null
   or service is null
   or message is null;

alter table public.contact_requests
  alter column full_name set not null,
  alter column email set not null,
  alter column service set not null,
  alter column message set not null;

create index if not exists contact_requests_created_at_idx
  on public.contact_requests (created_at desc);

create index if not exists contact_requests_status_idx
  on public.contact_requests (status);

alter table public.contact_requests enable row level security;

drop policy if exists "Service role can manage contact requests" on public.contact_requests;

create policy "Service role can manage contact requests"
  on public.contact_requests
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create table if not exists public.admin_clients (
  id uuid primary key default gen_random_uuid()
);

alter table public.admin_clients
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists full_name text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists country text,
  add column if not exists service text,
  add column if not exists status text not null default 'prospect',
  add column if not exists file_reference text,
  add column if not exists notes text,
  add column if not exists paid_amount numeric(12, 2) not null default 0,
  add column if not exists source text not null default 'admin';

update public.admin_clients
set
  full_name = coalesce(full_name, ''),
  email = coalesce(email, ''),
  service = coalesce(service, '')
where full_name is null
   or email is null
   or service is null;

alter table public.admin_clients
  alter column full_name set not null,
  alter column email set not null,
  alter column service set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'admin_clients_status_check'
  ) then
    alter table public.admin_clients
      add constraint admin_clients_status_check
      check (status in ('prospect', 'active', 'waiting', 'approved', 'closed'));
  end if;
end;
$$;

create index if not exists admin_clients_created_at_idx
  on public.admin_clients (created_at desc);

create index if not exists admin_clients_status_idx
  on public.admin_clients (status);

create index if not exists admin_clients_email_idx
  on public.admin_clients (email);

create or replace function public.set_admin_clients_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists admin_clients_updated_at on public.admin_clients;

create trigger admin_clients_updated_at
before update on public.admin_clients
for each row
execute function public.set_admin_clients_updated_at();

alter table public.admin_clients enable row level security;

drop policy if exists "Service role can manage admin clients" on public.admin_clients;

create policy "Service role can manage admin clients"
  on public.admin_clients
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
