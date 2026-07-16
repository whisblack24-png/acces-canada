-- Acces Canada - cycle de vie des questionnaires et synchronisation des dossiers
-- Migration additive, idempotente et compatible avec les donnees existantes.

do $$
begin
  raise notice 'Statuts de questionnaires existants: %',
    coalesce((select string_agg(distinct status, ', ' order by status) from public.client_questionnaires), 'aucun');
end $$;

alter table if exists public.client_questionnaires
  drop constraint if exists client_questionnaires_status_check;

update public.client_questionnaires
set status = case
  when status = 'submitted' then 'completed'
  when coalesce(progress_percent, 0) = 0 then 'draft'
  when coalesce(progress_percent, 0) >= 100 then 'completed'
  else 'in_progress'
end
where status is distinct from case
  when status = 'submitted' then 'completed'
  when coalesce(progress_percent, 0) = 0 then 'draft'
  when coalesce(progress_percent, 0) >= 100 then 'completed'
  else 'in_progress'
end;

alter table if exists public.client_questionnaires
  add constraint client_questionnaires_status_check
  check (status in ('draft', 'in_progress', 'completed')) not valid;

alter table if exists public.client_questionnaires
  validate constraint client_questionnaires_status_check;

create or replace function public.touch_client_from_questionnaire()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.admin_clients set updated_at = now() where id = new.client_id;
  return new;
end $$;

revoke all on function public.touch_client_from_questionnaire() from public, anon, authenticated;
grant execute on function public.touch_client_from_questionnaire() to service_role;

drop trigger if exists touch_client_from_questionnaire on public.client_questionnaires;
create trigger touch_client_from_questionnaire
after update on public.client_questionnaires
for each row execute function public.touch_client_from_questionnaire();

notify pgrst, 'reload schema';
