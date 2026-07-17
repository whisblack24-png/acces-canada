-- Accès Canada V2 — fondations sécurisées de l’assistant et de la bibliothèque.
-- Migration additive, idempotente et sans exposition des données aux clients.
create extension if not exists pgcrypto;

create table if not exists public.ai_assistant_runs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.admin_clients(id) on delete cascade,
  capability text not null,
  model text,
  status text not null default 'completed' check (status in ('completed','failed','fallback')),
  output_text text,
  created_by text not null default 'administrateur',
  created_at timestamptz not null default now()
);

create table if not exists public.internal_document_library (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null check (category in ('lettre','courriel','procedure','guide','checklist','pdf')),
  description text,
  content text,
  file_path text,
  status text not null default 'active' check (status in ('draft','active','archived')),
  tags text[] not null default '{}',
  created_by text not null default 'administrateur',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_assistant_runs_client_date_idx on public.ai_assistant_runs(client_id,created_at desc);
create index if not exists internal_document_library_category_idx on public.internal_document_library(category,status);
alter table public.ai_assistant_runs enable row level security;
alter table public.internal_document_library enable row level security;
revoke all on public.ai_assistant_runs, public.internal_document_library from anon, authenticated;
grant all on public.ai_assistant_runs, public.internal_document_library to service_role;
drop policy if exists service_role_ai_assistant_runs on public.ai_assistant_runs;
create policy service_role_ai_assistant_runs on public.ai_assistant_runs for all to service_role using(true) with check(true);
drop policy if exists service_role_internal_document_library on public.internal_document_library;
create policy service_role_internal_document_library on public.internal_document_library for all to service_role using(true) with check(true);
notify pgrst, 'reload schema';
