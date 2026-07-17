begin;

alter table public.staff_members add column if not exists previous_login_at timestamptz;

create table if not exists public.julie_conversations (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid references public.staff_members(id) on delete set null,
  client_id uuid references public.admin_clients(id) on delete set null,
  title text not null default 'Conversation avec Julie',
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.julie_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.julie_conversations(id) on delete cascade,
  role text not null check (role in ('staff','julie','system')),
  content text not null check (char_length(content) between 1 and 30000),
  created_at timestamptz not null default now()
);
create table if not exists public.julie_approval_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.admin_clients(id) on delete set null,
  requested_by uuid references public.staff_members(id) on delete set null,
  action_type text not null,
  title text not null,
  description text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','approved','rejected','executed','cancelled')),
  reviewed_by uuid references public.staff_members(id) on delete set null,
  reviewed_at timestamptz, review_note text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists julie_conversations_staff_idx on public.julie_conversations(staff_id,updated_at desc);
create index if not exists julie_messages_conversation_idx on public.julie_messages(conversation_id,created_at);
create index if not exists julie_approvals_status_idx on public.julie_approval_requests(status,created_at desc);
alter table public.julie_conversations enable row level security;
alter table public.julie_messages enable row level security;
alter table public.julie_approval_requests enable row level security;
revoke all on public.julie_conversations,public.julie_messages,public.julie_approval_requests from anon,authenticated;
grant all on public.julie_conversations,public.julie_messages,public.julie_approval_requests to service_role;
drop policy if exists service_role_julie_conversations on public.julie_conversations;
create policy service_role_julie_conversations on public.julie_conversations for all to service_role using(true) with check(true);
drop policy if exists service_role_julie_messages on public.julie_messages;
create policy service_role_julie_messages on public.julie_messages for all to service_role using(true) with check(true);
drop policy if exists service_role_julie_approvals on public.julie_approval_requests;
create policy service_role_julie_approvals on public.julie_approval_requests for all to service_role using(true) with check(true);
commit;
