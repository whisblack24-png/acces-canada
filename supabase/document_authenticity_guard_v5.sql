begin;

create extension if not exists pgcrypto;

create or replace function public.ensure_generated_document_authenticity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.verification_token := coalesce(new.verification_token, gen_random_uuid());
  new.issued_at := coalesce(new.issued_at, new.created_at, now());

  if nullif(trim(new.document_number), '') is null then
    new.document_number := 'AC-DOC-'
      || extract(year from new.issued_at)::int
      || '-'
      || upper(substr(replace(new.verification_token::text, '-', ''), 1, 8));
  end if;

  if nullif(trim(new.authenticity_hash), '') is null then
    new.authenticity_hash := encode(extensions.digest(
      new.document_number || '|'
      || coalesce(new.client_id::text, 'client-archive') || '|'
      || coalesce(new.document_type, 'document') || '|'
      || new.issued_at::text,
      'sha256'
    ), 'hex');
  end if;

  return new;
end
$$;

drop trigger if exists ensure_generated_document_authenticity_trigger
  on public.admin_generated_documents;
create trigger ensure_generated_document_authenticity_trigger
before insert or update on public.admin_generated_documents
for each row execute function public.ensure_generated_document_authenticity();

update public.admin_generated_documents
set document_number = document_number
where verification_token is null
   or nullif(trim(document_number), '') is null
   or nullif(trim(authenticity_hash), '') is null
   or issued_at is null;

revoke all on function public.ensure_generated_document_authenticity() from public, anon, authenticated;
grant execute on function public.ensure_generated_document_authenticity() to service_role;

commit;
