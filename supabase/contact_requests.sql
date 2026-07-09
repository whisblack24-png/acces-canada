create table if not exists public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  full_name text not null,
  email text not null,
  phone text,
  service text not null,
  country text,
  preferred_date text,
  message text not null,
  status text not null default 'new',
  source text not null default 'website'
);

create index if not exists contact_requests_created_at_idx
  on public.contact_requests (created_at desc);

create index if not exists contact_requests_status_idx
  on public.contact_requests (status);

alter table public.contact_requests enable row level security;

create policy "Service role can manage contact requests"
  on public.contact_requests
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
