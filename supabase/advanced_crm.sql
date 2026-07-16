-- Acces Canada - CRM avance, chronologie, taches et rappels
-- Migration additive, idempotente et compatible avec les dossiers existants.

create extension if not exists pgcrypto;

create table if not exists public.client_timeline_events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.admin_clients(id) on delete cascade,
  event_type text not null,
  title text not null,
  description text,
  source_table text,
  source_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by text not null default 'system'
);

create table if not exists public.client_tasks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.admin_clients(id) on delete cascade,
  title text not null,
  description text,
  priority text not null default 'normal',
  status text not null default 'todo',
  due_at timestamptz,
  assigned_to text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_tasks_priority_check check (priority in ('low', 'normal', 'high', 'urgent')),
  constraint client_tasks_status_check check (status in ('todo', 'in_progress', 'completed', 'cancelled'))
);

create table if not exists public.client_reminders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.admin_clients(id) on delete cascade,
  title text not null,
  message text not null,
  remind_at timestamptz not null,
  channel text not null default 'admin',
  status text not null default 'scheduled',
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_reminders_channel_check check (channel in ('admin', 'email')),
  constraint client_reminders_status_check check (status in ('scheduled', 'sent', 'cancelled'))
);

create index if not exists client_timeline_events_client_date_idx on public.client_timeline_events(client_id, created_at desc);
create index if not exists client_tasks_client_status_due_idx on public.client_tasks(client_id, status, due_at);
create index if not exists client_reminders_due_idx on public.client_reminders(status, remind_at) where status = 'scheduled';
create index if not exists client_reminders_client_id_idx on public.client_reminders(client_id);

alter table public.client_timeline_events enable row level security;
alter table public.client_tasks enable row level security;
alter table public.client_reminders enable row level security;
revoke all on public.client_timeline_events, public.client_tasks, public.client_reminders from anon, authenticated;
grant all on public.client_timeline_events, public.client_tasks, public.client_reminders to service_role;

drop policy if exists service_role_client_timeline_events on public.client_timeline_events;
create policy service_role_client_timeline_events on public.client_timeline_events for all to service_role using (true) with check (true);
drop policy if exists service_role_client_tasks on public.client_tasks;
create policy service_role_client_tasks on public.client_tasks for all to service_role using (true) with check (true);
drop policy if exists service_role_client_reminders on public.client_reminders;
create policy service_role_client_reminders on public.client_reminders for all to service_role using (true) with check (true);

create or replace function public.set_crm_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;
revoke all on function public.set_crm_updated_at() from public, anon, authenticated;
grant execute on function public.set_crm_updated_at() to service_role;

drop trigger if exists set_client_tasks_updated_at on public.client_tasks;
create trigger set_client_tasks_updated_at before update on public.client_tasks for each row execute function public.set_crm_updated_at();
drop trigger if exists set_client_reminders_updated_at on public.client_reminders;
create trigger set_client_reminders_updated_at before update on public.client_reminders for each row execute function public.set_crm_updated_at();

insert into public.client_timeline_events (client_id, event_type, title, description, source_table, source_id, created_at, created_by)
select id, 'dossier', 'Dossier créé', 'Création initiale du dossier client.', 'admin_clients', id::text, created_at, 'migration'
from public.admin_clients c
where not exists (select 1 from public.client_timeline_events e where e.client_id = c.id and e.source_table = 'admin_clients' and e.source_id = c.id::text and e.title = 'Dossier créé');

create or replace function public.capture_client_timeline_event()
returns trigger language plpgsql set search_path = public as $$
declare v_client_id uuid; v_title text; v_description text; v_source_id text;
begin
  v_client_id := new.client_id;
  v_source_id := new.id::text;
  if tg_table_name = 'client_questionnaires' then v_title := 'Questionnaire mis à jour'; v_description := new.questionnaire_type || ' - ' || new.status || ' - ' || new.progress_percent || '%';
  elsif tg_table_name = 'client_case_progress' then v_title := 'Étape du dossier mise à jour'; v_description := new.step_key || ' - ' || new.status;
  elsif tg_table_name = 'client_uploaded_documents' then v_title := 'Document client mis à jour'; v_description := new.file_name || ' - ' || new.status;
  elsif tg_table_name = 'admin_generated_documents' then v_title := 'Document généré'; v_description := new.document_label;
  elsif tg_table_name = 'client_payments' then v_title := 'Paiement mis à jour'; v_description := new.description || ' - ' || new.status;
  elsif tg_table_name = 'client_messages' then v_title := 'Message sécurisé'; v_description := case when new.sender = 'client' then 'Message reçu du client' else 'Message envoyé au client' end;
  else return new; end if;
  insert into public.client_timeline_events(client_id,event_type,title,description,source_table,source_id,created_by)
  values(v_client_id,tg_table_name,v_title,v_description,tg_table_name,v_source_id,'system');
  return new;
end $$;
revoke all on function public.capture_client_timeline_event() from public, anon, authenticated;
grant execute on function public.capture_client_timeline_event() to service_role;

drop trigger if exists timeline_questionnaires on public.client_questionnaires;
create trigger timeline_questionnaires after insert or update on public.client_questionnaires for each row execute function public.capture_client_timeline_event();
drop trigger if exists timeline_case_progress on public.client_case_progress;
create trigger timeline_case_progress after insert or update on public.client_case_progress for each row execute function public.capture_client_timeline_event();
drop trigger if exists timeline_uploaded_documents on public.client_uploaded_documents;
create trigger timeline_uploaded_documents after insert or update on public.client_uploaded_documents for each row execute function public.capture_client_timeline_event();
drop trigger if exists timeline_generated_documents on public.admin_generated_documents;
create trigger timeline_generated_documents after insert on public.admin_generated_documents for each row execute function public.capture_client_timeline_event();
drop trigger if exists timeline_payments on public.client_payments;
create trigger timeline_payments after insert or update on public.client_payments for each row execute function public.capture_client_timeline_event();
drop trigger if exists timeline_messages on public.client_messages;
create trigger timeline_messages after insert on public.client_messages for each row execute function public.capture_client_timeline_event();

notify pgrst, 'reload schema';
