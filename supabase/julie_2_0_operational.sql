begin;

alter table public.julie_conversations
  add column if not exists execution_mode text not null default 'automatic'
    check (execution_mode in ('automatic','approval_all')),
  add column if not exists memory jsonb not null default '{}'::jsonb;

create table if not exists public.julie_ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.julie_conversations(id) on delete set null,
  client_id uuid references public.admin_clients(id) on delete set null,
  feature text not null,
  model text not null,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  estimated_cost_usd numeric(12,6) not null default 0 check (estimated_cost_usd >= 0),
  status text not null default 'completed' check (status in ('completed','failed','quota_exceeded')),
  error_code text,
  created_at timestamptz not null default now()
);

create index if not exists julie_ai_usage_created_idx on public.julie_ai_usage_events(created_at desc);
create index if not exists julie_ai_usage_conversation_idx on public.julie_ai_usage_events(conversation_id, created_at desc);
create index if not exists julie_ai_usage_client_idx on public.julie_ai_usage_events(client_id, created_at desc);

alter table public.julie_ai_usage_events enable row level security;
revoke all on public.julie_ai_usage_events from anon, authenticated;
grant all on public.julie_ai_usage_events to service_role;
drop policy if exists service_role_julie_ai_usage on public.julie_ai_usage_events;
create policy service_role_julie_ai_usage on public.julie_ai_usage_events
  for all to service_role using (true) with check (true);

commit;
