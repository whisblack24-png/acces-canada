-- Accès Canada V2 — notifications, audit, automatisations et préparation multi-employés.
-- Migration additive, idempotente et compatible avec les dossiers existants.

create extension if not exists pgcrypto;

create table if not exists public.staff_members (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text not null,
  role text not null default 'agent' check (role in ('owner','admin','manager','agent','viewer')),
  status text not null default 'invited' check (status in ('invited','active','disabled')),
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.staff_members add column if not exists auth_user_id uuid unique;

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.admin_clients(id) on delete cascade,
  notification_type text not null,
  title text not null,
  message text not null,
  severity text not null default 'info' check (severity in ('info','success','warning','urgent')),
  href text,
  status text not null default 'unread' check (status in ('unread','read','dismissed')),
  dedupe_key text unique,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id text not null default 'system',
  actor_type text not null default 'system' check (actor_type in ('system','staff','client','public')),
  action text not null,
  entity_type text not null,
  entity_id text,
  client_id uuid references public.admin_clients(id) on delete set null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.client_tasks add column if not exists source_key text;
alter table public.client_tasks add column if not exists created_by text not null default 'administrateur';
alter table public.client_reminders add column if not exists created_by text not null default 'administrateur';

alter table public.admin_generated_documents add column if not exists version integer not null default 1;
alter table public.admin_generated_documents add column if not exists status text not null default 'active';
alter table public.admin_generated_documents add column if not exists replaced_document_id uuid references public.admin_generated_documents(id) on delete set null;
alter table public.admin_generated_documents drop constraint if exists admin_generated_documents_status_check;
alter table public.admin_generated_documents add constraint admin_generated_documents_status_check check (status in ('active','replaced','deleted')) not valid;
alter table public.admin_generated_documents validate constraint admin_generated_documents_status_check;

create index if not exists staff_members_status_idx on public.staff_members(status, role);
create index if not exists admin_notifications_status_date_idx on public.admin_notifications(status, created_at desc);
create index if not exists admin_notifications_client_idx on public.admin_notifications(client_id, created_at desc);
create index if not exists audit_logs_date_idx on public.audit_logs(created_at desc);
create index if not exists audit_logs_client_date_idx on public.audit_logs(client_id, created_at desc);
create index if not exists audit_logs_entity_idx on public.audit_logs(entity_type, entity_id);
create unique index if not exists client_tasks_source_key_idx on public.client_tasks(client_id, source_key) where source_key is not null;
create index if not exists generated_documents_versions_idx on public.admin_generated_documents(client_id, document_type, created_at desc);
create index if not exists generated_documents_replaced_id_idx on public.admin_generated_documents(replaced_document_id);

alter table public.staff_members enable row level security;
alter table public.admin_notifications enable row level security;
alter table public.audit_logs enable row level security;
revoke all on public.staff_members, public.admin_notifications, public.audit_logs from anon, authenticated;
grant all on public.staff_members, public.admin_notifications, public.audit_logs to service_role;

drop policy if exists service_role_staff_members on public.staff_members;
create policy service_role_staff_members on public.staff_members for all to service_role using (true) with check (true);
drop policy if exists service_role_admin_notifications on public.admin_notifications;
create policy service_role_admin_notifications on public.admin_notifications for all to service_role using (true) with check (true);
drop policy if exists service_role_audit_logs on public.audit_logs;
create policy service_role_audit_logs on public.audit_logs for all to service_role using (true) with check (true);

create or replace function public.set_v2_updated_at()
returns trigger language plpgsql set search_path = public as $$ begin new.updated_at = now(); return new; end $$;
revoke all on function public.set_v2_updated_at() from public, anon, authenticated;
grant execute on function public.set_v2_updated_at() to service_role;
drop trigger if exists set_staff_members_updated_at on public.staff_members;
create trigger set_staff_members_updated_at before update on public.staff_members for each row execute function public.set_v2_updated_at();

create or replace function public.capture_v2_audit()
returns trigger language plpgsql set search_path = public as $$
declare payload jsonb; row_id text; related_client uuid; operation text;
begin
  payload := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  row_id := payload->>'id';
  operation := lower(tg_op);
  if tg_table_name = 'admin_clients' then related_client := nullif(row_id,'')::uuid;
  elsif payload ? 'client_id' then related_client := nullif(payload->>'client_id','')::uuid;
  elsif tg_table_name = 'client_appointments' then
    select id into related_client from public.admin_clients where lower(email) = lower(payload->>'client_email') limit 1;
  end if;
  insert into public.audit_logs(action, entity_type, entity_id, client_id, summary, metadata)
  values(operation, tg_table_name, row_id, related_client, tg_table_name || ' · ' || operation,
    jsonb_strip_nulls(jsonb_build_object('status',payload->>'status','type',coalesce(payload->>'questionnaire_type',payload->>'document_type'),'reference',coalesce(payload->>'file_reference',payload->>'booking_reference'))));
  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke all on function public.capture_v2_audit() from public, anon, authenticated;
grant execute on function public.capture_v2_audit() to service_role;

do $audit_triggers$
declare table_name text;
begin
  foreach table_name in array array['admin_clients','client_questionnaires','client_case_progress','client_uploaded_documents','admin_generated_documents','client_payments','client_appointments','client_tasks','client_reminders','client_messages']
  loop
    execute format('drop trigger if exists audit_%I on public.%I', table_name, table_name);
    execute format('create trigger audit_%I after insert or update or delete on public.%I for each row execute function public.capture_v2_audit()', table_name, table_name);
  end loop;
end $audit_triggers$;

create or replace function public.notify_new_client_v2()
returns trigger language plpgsql set search_path = public as $$
begin
  insert into public.admin_notifications(client_id, notification_type, title, message, severity, href, dedupe_key)
  values(new.id,'new_client','Nouveau client',new.full_name || ' a été ajouté au CRM.','success','/admin/clients/' || new.id,'new-client:' || new.id)
  on conflict (dedupe_key) do nothing;
  return new;
end $$;

create or replace function public.automate_questionnaire_completion_v2()
returns trigger language plpgsql set search_path = public as $$
declare task_key text; task_title text; step_name text;
begin
  if new.status <> 'completed' or (tg_op = 'UPDATE' and old.status = 'completed') then return new; end if;
  task_key := 'questionnaire:' || new.questionnaire_type || ':review';
  task_title := case when new.questionnaire_type = 'client_principal' then 'Analyser le questionnaire du client' else 'Analyser le questionnaire du garant' end;
  step_name := case when new.questionnaire_type = 'client_principal' then 'client_questionnaire' else 'guarantor_questionnaire' end;
  insert into public.client_tasks(client_id,title,description,priority,status,due_at,source_key,created_by)
  values(new.client_id,task_title,'Vérifier les réponses, les pièces disponibles et les incohérences éventuelles.','high','todo',now()+interval '2 days',task_key,'automatisation')
  on conflict (client_id, source_key) where source_key is not null do nothing;
  insert into public.client_tasks(client_id,title,description,priority,status,due_at,source_key,created_by)
  values(new.client_id,'Préparer les documents requis','Produire et contrôler les documents générés à partir des réponses.','normal','todo',now()+interval '4 days','questionnaire:' || new.questionnaire_type || ':documents','automatisation')
  on conflict (client_id, source_key) where source_key is not null do nothing;
  update public.client_case_progress set status='completed', updated_at=now(), updated_by='automatisation' where client_id=new.client_id and step_key=step_name;
  update public.client_case_progress set status='in_progress', updated_at=now(), updated_by='automatisation' where client_id=new.client_id and step_key='case_analysis' and status='todo';
  insert into public.admin_notifications(client_id,notification_type,title,message,severity,href,dedupe_key)
  values(new.client_id,'questionnaire_completed','Questionnaire terminé',case when new.questionnaire_type='client_principal' then 'Le questionnaire client est prêt pour analyse.' else 'Le questionnaire du garant est prêt pour analyse.' end,'success','/admin/clients/' || new.client_id,'questionnaire-completed:' || new.id)
  on conflict (dedupe_key) do nothing;
  return new;
end $$;

create or replace function public.notify_document_v2()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op='INSERT' then
    insert into public.admin_notifications(client_id,notification_type,title,message,severity,href,dedupe_key)
    values(new.client_id,'document_added','Nouveau document',new.file_name || ' a été ajouté au dossier.','info','/admin/clients/' || new.client_id,'document-added:' || new.id)
    on conflict (dedupe_key) do nothing;
  end if;
  return new;
end $$;

create or replace function public.notify_payment_v2()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status='paid' and (tg_op='INSERT' or old.status is distinct from 'paid') then
    insert into public.admin_notifications(client_id,notification_type,title,message,severity,href,dedupe_key)
    values(new.client_id,'payment_received','Paiement reçu',new.description || ' · ' || round(new.amount_cents::numeric/100,2) || ' ' || upper(new.currency),'success','/admin/clients/' || new.client_id,'payment-paid:' || new.id)
    on conflict (dedupe_key) do nothing;
  end if;
  return new;
end $$;

create or replace function public.notify_appointment_v2()
returns trigger language plpgsql set search_path = public as $$
declare related_client uuid;
begin
  select id into related_client from public.admin_clients where lower(email)=lower(new.client_email) limit 1;
  insert into public.admin_notifications(client_id,notification_type,title,message,severity,href,dedupe_key)
  values(related_client,'appointment_upcoming','Nouveau rendez-vous',new.client_full_name || ' · ' || new.booking_reference || ' · ' || to_char(new.starts_at at time zone 'America/Toronto','YYYY-MM-DD HH24:MI'),'info',case when related_client is null then '/admin/rendez-vous' else '/admin/clients/' || related_client end,'appointment:' || new.id)
  on conflict (dedupe_key) do nothing;
  return new;
end $$;

revoke all on function public.notify_new_client_v2(), public.automate_questionnaire_completion_v2(), public.notify_document_v2(), public.notify_payment_v2(), public.notify_appointment_v2() from public, anon, authenticated;
grant execute on function public.notify_new_client_v2(), public.automate_questionnaire_completion_v2(), public.notify_document_v2(), public.notify_payment_v2(), public.notify_appointment_v2() to service_role;

drop trigger if exists notify_new_client_v2 on public.admin_clients;
create trigger notify_new_client_v2 after insert on public.admin_clients for each row execute function public.notify_new_client_v2();
drop trigger if exists automate_questionnaire_completion_v2 on public.client_questionnaires;
create trigger automate_questionnaire_completion_v2 after insert or update on public.client_questionnaires for each row execute function public.automate_questionnaire_completion_v2();
drop trigger if exists notify_document_v2 on public.client_uploaded_documents;
create trigger notify_document_v2 after insert on public.client_uploaded_documents for each row execute function public.notify_document_v2();
drop trigger if exists notify_payment_v2 on public.client_payments;
create trigger notify_payment_v2 after insert or update on public.client_payments for each row execute function public.notify_payment_v2();
drop trigger if exists notify_appointment_v2 on public.client_appointments;
create trigger notify_appointment_v2 after insert on public.client_appointments for each row execute function public.notify_appointment_v2();

notify pgrst, 'reload schema';
