begin;

alter table public.julie_approval_requests
  add column if not exists reviewed_by_name text,
  add column if not exists execution_started_at timestamptz,
  add column if not exists executed_at timestamptz,
  add column if not exists execution_duration_ms integer,
  add column if not exists execution_result jsonb,
  add column if not exists execution_error text;

alter table public.julie_approval_requests
  drop constraint if exists julie_approval_requests_status_check;
alter table public.julie_approval_requests
  add constraint julie_approval_requests_status_check
  check (status in ('pending','approved','rejected','executed','failed','cancelled'));

create index if not exists julie_approvals_history_idx
  on public.julie_approval_requests(status, reviewed_at desc);

commit;
