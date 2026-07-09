-- Acces Canada - extension du module dossiers clients
-- A executer dans Supabase SQL Editor avant d'utiliser les nouveaux champs du CRM.

alter table public.admin_clients
  add column if not exists internal_notes text,
  add column if not exists documents_received text[] not null default '{}',
  add column if not exists documents_missing text[] not null default '{}',
  add column if not exists action_history jsonb not null default '[]'::jsonb;

update public.admin_clients
set status = case status
  when 'prospect' then 'nouveau'
  when 'active' then 'en_traitement'
  when 'waiting' then 'en_attente'
  when 'approved' then 'termine'
  when 'closed' then 'termine'
  else status
end
where status in ('prospect', 'active', 'waiting', 'approved', 'closed');

update public.admin_clients
set status = 'nouveau'
where status is null
   or status not in ('nouveau', 'en_attente', 'incomplet', 'en_traitement', 'termine', 'refuse');

update public.admin_clients
set service = 'autre'
where service is null or length(trim(service)) = 0;

update public.admin_clients
set internal_notes = notes
where internal_notes is null and notes is not null;

update public.admin_clients
set action_history = jsonb_build_array(
  jsonb_build_object(
    'date', coalesce(created_at, now()),
    'action', 'Dossier client importe dans le module de suivi.'
  )
)
where action_history is null or action_history = '[]'::jsonb;

alter table public.admin_clients
  drop constraint if exists admin_clients_status_check;

alter table public.admin_clients
  add constraint admin_clients_status_check
  check (status in ('nouveau', 'en_attente', 'incomplet', 'en_traitement', 'termine', 'refuse'));

notify pgrst, 'reload schema';
