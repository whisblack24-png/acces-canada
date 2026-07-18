begin;

create table if not exists public.julie_global_memories (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.admin_clients(id) on delete cascade,
  conversation_id uuid references public.julie_conversations(id) on delete set null,
  memory_type text not null check (memory_type in ('preference','decision','document','action','client_context','recommendation')),
  dedupe_key text not null unique,
  content text not null check (char_length(content) between 1 and 12000),
  metadata jsonb not null default '{}'::jsonb,
  importance smallint not null default 5 check (importance between 1 and 10),
  last_accessed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists julie_global_memories_client_idx on public.julie_global_memories(client_id, importance desc, updated_at desc);
create index if not exists julie_global_memories_type_idx on public.julie_global_memories(memory_type, updated_at desc);
alter table public.julie_global_memories enable row level security;
revoke all on public.julie_global_memories from anon, authenticated;
grant all on public.julie_global_memories to service_role;
drop policy if exists service_role_julie_global_memories on public.julie_global_memories;
create policy service_role_julie_global_memories on public.julie_global_memories for all to service_role using (true) with check (true);

commit;
