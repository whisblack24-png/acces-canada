-- Gestionnaire documentaire CRM Accès Canada.
-- Migration additive, compatible avec les données historiques et idempotente.

alter table public.client_uploaded_documents
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists category text not null default 'correspondance',
  add column if not exists version integer not null default 1,
  add column if not exists status text not null default 'active',
  add column if not exists replaced_document_id uuid references public.client_uploaded_documents(id) on delete set null,
  add column if not exists deleted_at timestamptz,
  add column if not exists uploaded_by text not null default 'Client',
  add column if not exists original_category text;

-- Inventaire avant conversion, visible dans les messages de l'éditeur SQL.
do $migration$
declare
  categories jsonb;
begin
  select coalesce(jsonb_object_agg(category_name, document_count), '{}'::jsonb)
    into categories
  from (
    select coalesce(nullif(btrim(category), ''), '<NULL/VIDE>') as category_name,
           count(*) as document_count
    from public.client_uploaded_documents
    group by 1
    order by 1
  ) inventory;
  raise notice 'Catégories trouvées avant normalisation : %', categories;
end
$migration$;

-- Retire les contraintes d'une éventuelle exécution antérieure interrompue.
alter table public.client_uploaded_documents
  drop constraint if exists client_uploaded_documents_category_check;
alter table public.client_uploaded_documents
  drop constraint if exists client_uploaded_documents_status_check;

-- Normalise également les anciens statuts avant de réinstaller leur contrainte.
update public.client_uploaded_documents
set status = case
  when lower(btrim(coalesce(status, ''))) in ('active', 'replaced', 'deleted')
    then lower(btrim(status))
  when lower(btrim(coalesce(status, ''))) in ('archive', 'archived', 'remplace', 'remplacé')
    then 'replaced'
  when lower(btrim(coalesce(status, ''))) in ('supprime', 'supprimé')
    then 'deleted'
  else 'active'
end;

-- Les valeurs inconnues sont classées dans « Correspondance ». Leur libellé
-- original est conservé dans original_category pour ne perdre aucune information.
update public.client_uploaded_documents
set
  original_category = case
    when lower(btrim(coalesce(category, ''))) in (
      'identite', 'passeport', 'refus_ircc', 'formulaires_ircc', 'situation_financiere',
      'emploi_commerce', 'attaches_familiales', 'garant_financier', 'correspondance', 'acces_canada'
    ) then original_category
    else coalesce(original_category, nullif(btrim(category), ''))
  end,
  category = case
    when lower(btrim(coalesce(category, ''))) in (
      'identite', 'passeport', 'refus_ircc', 'formulaires_ircc', 'situation_financiere',
      'emploi_commerce', 'attaches_familiales', 'garant_financier', 'correspondance', 'acces_canada'
    ) then lower(btrim(category))
    when lower(btrim(coalesce(category, ''))) in ('permis', 'carte_identite', 'piece_identite', 'identité') then 'identite'
    when lower(btrim(coalesce(category, ''))) in ('refus', 'lettre_refus', 'refus ircc') then 'refus_ircc'
    when lower(btrim(coalesce(category, ''))) in ('formulaire', 'formulaires', 'formulaire_ircc') then 'formulaires_ircc'
    when lower(btrim(coalesce(category, ''))) in ('releve', 'relevé', 'releve_bancaire', 'preuve_financiere', 'finance') then 'situation_financiere'
    when lower(btrim(coalesce(category, ''))) in ('diplome', 'diplôme', 'emploi', 'commerce', 'travail') then 'emploi_commerce'
    when lower(btrim(coalesce(category, ''))) in ('famille', 'liens_familiaux') then 'attaches_familiales'
    when lower(btrim(coalesce(category, ''))) in ('garant', 'parrain') then 'garant_financier'
    when lower(btrim(coalesce(category, ''))) in ('lettre', 'message', 'autre', '') then 'correspondance'
    when lower(btrim(coalesce(category, ''))) in ('document_genere', 'documents_generes', 'acces canada') then 'acces_canada'
    else 'correspondance'
  end;

-- Inventaire de contrôle après conversion.
do $migration$
declare
  categories jsonb;
begin
  select coalesce(jsonb_object_agg(category_name, document_count), '{}'::jsonb)
    into categories
  from (
    select category as category_name, count(*) as document_count
    from public.client_uploaded_documents
    group by category
    order by category
  ) inventory;
  raise notice 'Catégories après normalisation : %', categories;
end
$migration$;

alter table public.client_uploaded_documents
  add constraint client_uploaded_documents_status_check
  check (status in ('active', 'replaced', 'deleted')) not valid;
alter table public.client_uploaded_documents
  validate constraint client_uploaded_documents_status_check;

alter table public.client_uploaded_documents
  add constraint client_uploaded_documents_category_check check (category in (
    'identite', 'passeport', 'refus_ircc', 'formulaires_ircc', 'situation_financiere',
    'emploi_commerce', 'attaches_familiales', 'garant_financier', 'correspondance', 'acces_canada'
  )) not valid;
alter table public.client_uploaded_documents
  validate constraint client_uploaded_documents_category_check;

create index if not exists client_uploaded_documents_active_category_idx
  on public.client_uploaded_documents(client_id, category, created_at desc) where status = 'active';
create index if not exists client_uploaded_documents_replaced_id_idx
  on public.client_uploaded_documents(replaced_document_id);

alter table public.client_uploaded_documents enable row level security;
revoke all on public.client_uploaded_documents from anon, authenticated;
grant all on public.client_uploaded_documents to service_role;
drop policy if exists "Service role can manage client uploaded documents" on public.client_uploaded_documents;
create policy "Service role can manage client uploaded documents"
  on public.client_uploaded_documents for all to service_role using (true) with check (true);

notify pgrst, 'reload schema';
