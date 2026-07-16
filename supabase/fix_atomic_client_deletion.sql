-- Accès Canada V2 — suppression atomique d'un client et conservation de l'audit.
-- Migration additive, idempotente et compatible avec les données existantes.

alter table if exists public.audit_logs
  add column if not exists client_id_snapshot uuid,
  add column if not exists client_full_name text,
  add column if not exists client_email text,
  add column if not exists client_file_reference text,
  add column if not exists deleted_at timestamptz;

alter table if exists public.audit_logs alter column client_id drop not null;
alter table if exists public.audit_logs drop constraint if exists audit_logs_client_id_fkey;
alter table if exists public.audit_logs
  add constraint audit_logs_client_id_fkey
  foreign key (client_id) references public.admin_clients(id) on delete set null not valid;

create index if not exists audit_logs_client_snapshot_idx
  on public.audit_logs(client_id_snapshot, created_at desc);

do $missing_client_foreign_keys$
begin
  if to_regclass('public.admin_generated_documents') is not null
     and not exists (select 1 from pg_constraint where conname = 'admin_generated_documents_client_id_fkey') then
    alter table public.admin_generated_documents
      add constraint admin_generated_documents_client_id_fkey
      foreign key (client_id) references public.admin_clients(id) on delete cascade not valid;
  end if;

  if to_regclass('public.client_uploaded_documents') is not null
     and not exists (select 1 from pg_constraint where conname = 'client_uploaded_documents_client_id_fkey') then
    alter table public.client_uploaded_documents
      add constraint client_uploaded_documents_client_id_fkey
      foreign key (client_id) references public.admin_clients(id) on delete cascade not valid;
  end if;

  if to_regclass('public.client_login_codes') is not null
     and not exists (select 1 from pg_constraint where conname = 'client_login_codes_client_id_fkey') then
    alter table public.client_login_codes
      add constraint client_login_codes_client_id_fkey
      foreign key (client_id) references public.admin_clients(id) on delete cascade not valid;
  end if;
end $missing_client_foreign_keys$;

create or replace function public.capture_v2_audit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  payload jsonb;
  row_id text;
  related_client_id uuid;
  snapshot_client_id uuid;
  operation text;
  audit_actor_id text;
  audit_actor_type text;
begin
  payload := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  row_id := payload->>'id';
  operation := lower(tg_op);
  audit_actor_id := coalesce(nullif(current_setting('app.audit_actor_id', true), ''), 'system');
  audit_actor_type := coalesce(nullif(current_setting('app.audit_actor_type', true), ''), 'system');

  if tg_table_name = 'admin_clients' then
    snapshot_client_id := nullif(row_id, '')::uuid;
    related_client_id := snapshot_client_id;
    if tg_op = 'DELETE' then
      operation := 'client_deleted';
      related_client_id := null;
    end if;
  elsif payload ? 'client_id' then
    snapshot_client_id := nullif(payload->>'client_id', '')::uuid;
    select c.id into related_client_id
      from public.admin_clients c where c.id = snapshot_client_id;
  elsif tg_table_name = 'client_appointments' then
    select c.id into related_client_id
      from public.admin_clients c
      where lower(c.email) = lower(payload->>'client_email') limit 1;
    snapshot_client_id := related_client_id;
  end if;

  insert into public.audit_logs(
    actor_id, actor_type, action, entity_type, entity_id, client_id,
    client_id_snapshot, client_full_name, client_email, client_file_reference,
    deleted_at, summary, metadata
  ) values (
    audit_actor_id,
    case when audit_actor_type in ('system', 'staff', 'client', 'public') then audit_actor_type else 'system' end,
    operation,
    tg_table_name,
    row_id,
    related_client_id,
    snapshot_client_id,
    case when tg_table_name = 'admin_clients' then payload->>'full_name' end,
    case when tg_table_name = 'admin_clients' then payload->>'email' end,
    case when tg_table_name = 'admin_clients' then payload->>'file_reference' end,
    case when tg_table_name = 'admin_clients' and tg_op = 'DELETE' then now() end,
    case
      when tg_table_name = 'admin_clients' and tg_op = 'DELETE'
        then 'Client supprimé · ' || coalesce(payload->>'full_name', 'Nom non renseigné')
      else tg_table_name || ' · ' || operation
    end,
    jsonb_strip_nulls(jsonb_build_object(
      'client_id_snapshot', snapshot_client_id,
      'client_full_name', case when tg_table_name = 'admin_clients' then payload->>'full_name' end,
      'client_email', case when tg_table_name = 'admin_clients' then payload->>'email' end,
      'client_file_reference', case when tg_table_name = 'admin_clients' then payload->>'file_reference' end,
      'status', payload->>'status',
      'type', coalesce(payload->>'questionnaire_type', payload->>'document_type'),
      'reference', coalesce(payload->>'file_reference', payload->>'booking_reference')
    ))
  );

  return case when tg_op = 'DELETE' then old else new end;
end
$$;

revoke all on function public.capture_v2_audit() from public, anon, authenticated;
grant execute on function public.capture_v2_audit() to service_role;

create or replace function public.delete_admin_client_v2(
  p_client_id uuid,
  p_actor_id text default 'administrateur',
  p_actor_type text default 'staff'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  client_record public.admin_clients%rowtype;
  file_paths jsonb;
begin
  select * into client_record
    from public.admin_clients
    where id = p_client_id
    for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'CLIENT_NOT_FOUND';
  end if;

  select coalesce(jsonb_agg(d.file_path order by d.created_at), '[]'::jsonb)
    into file_paths
    from public.client_uploaded_documents d
    where d.client_id = p_client_id;

  perform set_config('app.audit_actor_id', left(coalesce(nullif(p_actor_id, ''), 'administrateur'), 200), true);
  perform set_config(
    'app.audit_actor_type',
    case when p_actor_type in ('system', 'staff', 'client', 'public') then p_actor_type else 'staff' end,
    true
  );

  delete from public.admin_clients where id = p_client_id;

  return jsonb_build_object(
    'id', client_record.id,
    'full_name', client_record.full_name,
    'email', client_record.email,
    'file_reference', client_record.file_reference,
    'uploaded_file_paths', file_paths,
    'deleted_at', now()
  );
end
$$;

revoke all on function public.delete_admin_client_v2(uuid, text, text) from public, anon, authenticated;
grant execute on function public.delete_admin_client_v2(uuid, text, text) to service_role;

notify pgrst, 'reload schema';
