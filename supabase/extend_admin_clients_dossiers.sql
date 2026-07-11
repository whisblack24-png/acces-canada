-- Accès Canada - extension du module dossiers clients
-- A executer dans Supabase SQL Editor avant d'utiliser les nouveaux champs du CRM.

alter table public.admin_clients
  add column if not exists phone text,
  add column if not exists country text,
  add column if not exists file_reference text,
  add column if not exists public_notes text,
  add column if not exists internal_notes text,
  add column if not exists documents_received text[] not null default '{}',
  add column if not exists documents_missing text[] not null default '{}',
  add column if not exists action_history jsonb not null default '[]'::jsonb,
  add column if not exists paid_amount numeric not null default 0;

update public.admin_clients
set status = case status
  when 'prospect' then 'nouveau'
  when 'active' then 'en_traitement'
  when 'waiting' then 'documents_en_attente'
  when 'en_attente' then 'documents_en_attente'
  when 'incomplet' then 'documents_en_attente'
  when 'approved' then 'approuve'
  when 'closed' then 'termine'
  else status
end
where status in ('prospect', 'active', 'waiting', 'en_attente', 'incomplet', 'approved', 'closed');

update public.admin_clients
set status = 'nouveau'
where status is null
   or status not in ('nouveau', 'documents_en_attente', 'en_preparation', 'soumis', 'en_traitement', 'approuve', 'refuse', 'termine');

update public.admin_clients
set service = 'autre'
where service is null or length(trim(service)) = 0;

update public.admin_clients
set internal_notes = notes
where internal_notes is null and notes is not null;

update public.admin_clients
set file_reference = 'AC-' || extract(year from coalesce(public.admin_clients.created_at, now()))::int || '-MIG-' || substring(public.admin_clients.id::text, 1, 8)
from (
  select id, row_number() over (partition by extract(year from coalesce(created_at, now())) order by coalesce(created_at, now()), id) as row_number
  from public.admin_clients
  where file_reference is null or length(trim(file_reference)) = 0
) references_to_create
where public.admin_clients.id = references_to_create.id;

with duplicated_references as (
  select
    id,
    row_number() over (
      partition by file_reference
      order by coalesce(created_at, now()), id
    ) as duplicate_rank,
    row_number() over (
      partition by extract(year from coalesce(created_at, now()))
      order by coalesce(created_at, now()), id
    ) as year_rank
  from public.admin_clients
  where file_reference is not null and length(trim(file_reference)) > 0
)
update public.admin_clients
set file_reference = 'AC-' || extract(year from coalesce(public.admin_clients.created_at, now()))::int || '-MIG-' || substring(public.admin_clients.id::text, 1, 8)
from duplicated_references
where public.admin_clients.id = duplicated_references.id
  and duplicated_references.duplicate_rank > 1;

update public.admin_clients
set action_history = jsonb_build_array(
  jsonb_build_object(
    'date', coalesce(created_at, now()),
    'action', 'Dossier client importé dans le module de suivi.'
  )
)
where action_history is null or action_history = '[]'::jsonb;

alter table public.admin_clients
  drop constraint if exists admin_clients_status_check;

alter table public.admin_clients
  add constraint admin_clients_status_check
  check (status in ('nouveau', 'documents_en_attente', 'en_preparation', 'soumis', 'en_traitement', 'approuve', 'refuse', 'termine'));

create unique index if not exists admin_clients_file_reference_unique
  on public.admin_clients (file_reference)
  where file_reference is not null and length(trim(file_reference)) > 0;

notify pgrst, 'reload schema';
