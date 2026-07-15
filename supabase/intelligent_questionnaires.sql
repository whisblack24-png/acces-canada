-- Acces Canada - Questionnaires intelligents et suivi du dossier
-- Migration additive, idempotente et compatible avec les donnees existantes.

create extension if not exists pgcrypto;

do $$ begin
  raise notice 'Categories documentaires existantes: %',
    coalesce((select string_agg(distinct category, ', ' order by category) from public.client_uploaded_documents), 'aucune');
end $$;

-- Aligne le gestionnaire documentaire avec les formats deja acceptes par l'application.
alter table if exists public.client_uploaded_documents
  drop constraint if exists client_uploaded_documents_type_check;
alter table if exists public.client_uploaded_documents
  add constraint client_uploaded_documents_type_check check (
    lower(file_type) in (
      'application/pdf', 'image/jpeg', 'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
  ) not valid;
alter table if exists public.client_uploaded_documents
  validate constraint client_uploaded_documents_type_check;

update storage.buckets
set file_size_limit = 15728640,
    allowed_mime_types = array[
      'application/pdf', 'image/jpeg', 'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
where id = 'client-documents';

create table if not exists public.client_questionnaires (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.admin_clients(id) on delete cascade,
  questionnaire_type text not null,
  status text not null default 'draft',
  answers_encrypted text not null default '',
  schema_version integer not null default 1,
  section_progress jsonb not null default '{}'::jsonb,
  progress_percent integer not null default 0,
  respondent_name text,
  respondent_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_saved_at timestamptz,
  submitted_at timestamptz,
  constraint client_questionnaires_type_check check (questionnaire_type in ('client_principal', 'garant_financier')),
  constraint client_questionnaires_status_check check (status in ('draft', 'submitted')),
  constraint client_questionnaires_progress_check check (progress_percent between 0 and 100),
  constraint client_questionnaires_client_type_key unique (client_id, questionnaire_type)
);

create table if not exists public.questionnaire_access_links (
  id uuid primary key default gen_random_uuid(),
  questionnaire_id uuid not null references public.client_questionnaires(id) on delete cascade,
  token_hash text not null unique,
  token_prefix text not null,
  recipient_name text,
  recipient_email text,
  created_by text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  disabled_at timestamptz,
  last_accessed_at timestamptz,
  constraint questionnaire_access_links_expiry_check check (expires_at > created_at)
);

create table if not exists public.client_case_progress (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.admin_clients(id) on delete cascade,
  step_key text not null,
  status text not null default 'todo',
  admin_note text,
  updated_at timestamptz not null default now(),
  updated_by text,
  constraint client_case_progress_step_check check (step_key in (
    'dossier_created', 'service_agreement', 'payment', 'client_questionnaire',
    'guarantor_questionnaire', 'documents_received', 'case_analysis', 'drafting',
    'validation_signature', 'ircc_submission', 'decision'
  )),
  constraint client_case_progress_status_check check (status in ('todo', 'in_progress', 'completed', 'not_applicable')),
  constraint client_case_progress_client_step_key unique (client_id, step_key)
);

create index if not exists client_questionnaires_client_idx on public.client_questionnaires(client_id);
create index if not exists questionnaire_access_links_questionnaire_idx on public.questionnaire_access_links(questionnaire_id);
create index if not exists questionnaire_access_links_active_idx on public.questionnaire_access_links(token_hash) where disabled_at is null;
create index if not exists client_case_progress_client_idx on public.client_case_progress(client_id);

alter table public.client_questionnaires enable row level security;
alter table public.questionnaire_access_links enable row level security;
alter table public.client_case_progress enable row level security;

revoke all on public.client_questionnaires from anon, authenticated;
revoke all on public.questionnaire_access_links from anon, authenticated;
revoke all on public.client_case_progress from anon, authenticated;
grant all on public.client_questionnaires to service_role;
grant all on public.questionnaire_access_links to service_role;
grant all on public.client_case_progress to service_role;

drop policy if exists "service_role_client_questionnaires" on public.client_questionnaires;
create policy "service_role_client_questionnaires" on public.client_questionnaires for all to service_role using (true) with check (true);
drop policy if exists "service_role_questionnaire_access_links" on public.questionnaire_access_links;
create policy "service_role_questionnaire_access_links" on public.questionnaire_access_links for all to service_role using (true) with check (true);
drop policy if exists "service_role_client_case_progress" on public.client_case_progress;
create policy "service_role_client_case_progress" on public.client_case_progress for all to service_role using (true) with check (true);

insert into public.client_questionnaires (client_id, questionnaire_type)
select c.id, q.questionnaire_type
from public.admin_clients c
cross join (values ('client_principal'), ('garant_financier')) q(questionnaire_type)
on conflict (client_id, questionnaire_type) do nothing;

insert into public.client_case_progress (client_id, step_key, status, updated_by)
select c.id, s.step_key,
  case when s.step_key = 'dossier_created' then 'completed' else 'todo' end,
  'migration'
from public.admin_clients c
cross join (values
  ('dossier_created'), ('service_agreement'), ('payment'), ('client_questionnaire'),
  ('guarantor_questionnaire'), ('documents_received'), ('case_analysis'), ('drafting'),
  ('validation_signature'), ('ircc_submission'), ('decision')
) s(step_key)
on conflict (client_id, step_key) do nothing;

create or replace function public.set_questionnaire_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists set_client_questionnaires_updated_at on public.client_questionnaires;
create trigger set_client_questionnaires_updated_at before update on public.client_questionnaires
for each row execute function public.set_questionnaire_updated_at();

create or replace function public.initialize_client_questionnaires_and_progress()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.client_questionnaires (client_id, questionnaire_type)
  values (new.id, 'client_principal'), (new.id, 'garant_financier')
  on conflict (client_id, questionnaire_type) do nothing;
  insert into public.client_case_progress (client_id, step_key, status, updated_by)
  select new.id, step_key, case when step_key = 'dossier_created' then 'completed' else 'todo' end, 'system'
  from (values
    ('dossier_created'), ('service_agreement'), ('payment'), ('client_questionnaire'),
    ('guarantor_questionnaire'), ('documents_received'), ('case_analysis'), ('drafting'),
    ('validation_signature'), ('ircc_submission'), ('decision')
  ) s(step_key)
  on conflict (client_id, step_key) do nothing;
  return new;
end $$;

revoke all on function public.initialize_client_questionnaires_and_progress() from public, anon, authenticated;
grant execute on function public.initialize_client_questionnaires_and_progress() to service_role;
revoke all on function public.set_questionnaire_updated_at() from public, anon, authenticated;
grant execute on function public.set_questionnaire_updated_at() to service_role;

drop trigger if exists initialize_client_questionnaires_and_progress on public.admin_clients;
create trigger initialize_client_questionnaires_and_progress after insert on public.admin_clients
for each row execute function public.initialize_client_questionnaires_and_progress();

notify pgrst, 'reload schema';
