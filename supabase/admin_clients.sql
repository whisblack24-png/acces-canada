create table if not exists public.admin_clients (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  full_name text not null,
  email text not null,
  phone text,
  country text,
  service text not null,
  status text not null default 'prospect'
    check (status in ('prospect', 'active', 'waiting', 'approved', 'closed')),
  file_reference text,
  notes text,
  paid_amount numeric(12, 2) not null default 0,
  source text not null default 'admin'
);

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

create policy "Service role can manage admin clients"
  on public.admin_clients
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
