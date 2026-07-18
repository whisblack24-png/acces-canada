begin;

alter table public.julie_conversations
  add column if not exists working_memory jsonb not null default '{}'::jsonb,
  add column if not exists last_completed_action_at timestamptz;

create table if not exists public.julie_goal_runs (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.julie_conversations(id) on delete cascade,
  client_id uuid references public.admin_clients(id) on delete set null,
  objective text not null check (char_length(objective) between 1 and 30000),
  plan jsonb not null default '[]'::jsonb,
  status text not null default 'planning' check (status in ('planning','awaiting_approval','executing','completed','failed','cancelled')),
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.julie_action_runs (
  id uuid primary key default gen_random_uuid(),
  goal_run_id uuid references public.julie_goal_runs(id) on delete cascade,
  conversation_id uuid not null references public.julie_conversations(id) on delete cascade,
  approval_id uuid references public.julie_approval_requests(id) on delete set null,
  idempotency_key text not null unique,
  action_index integer not null default 0 check (action_index >= 0),
  tool text not null,
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  status text not null default 'pending' check (status in ('pending','awaiting_approval','executing','completed','failed','cancelled')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists julie_goal_runs_conversation_idx on public.julie_goal_runs(conversation_id, created_at desc);
create index if not exists julie_goal_runs_status_idx on public.julie_goal_runs(status, updated_at desc);
create index if not exists julie_action_runs_goal_idx on public.julie_action_runs(goal_run_id, action_index);
create index if not exists julie_action_runs_approval_idx on public.julie_action_runs(approval_id);

alter table public.julie_goal_runs enable row level security;
alter table public.julie_action_runs enable row level security;
revoke all on public.julie_goal_runs, public.julie_action_runs from anon, authenticated;
grant all on public.julie_goal_runs, public.julie_action_runs to service_role;
drop policy if exists service_role_julie_goal_runs on public.julie_goal_runs;
create policy service_role_julie_goal_runs on public.julie_goal_runs for all to service_role using (true) with check (true);
drop policy if exists service_role_julie_action_runs on public.julie_action_runs;
create policy service_role_julie_action_runs on public.julie_action_runs for all to service_role using (true) with check (true);

commit;
