-- Migration additive et idempotente pour le classement documentaire prudent.
alter table public.client_uploaded_documents
  drop constraint if exists client_uploaded_documents_category_check;

alter table public.client_uploaded_documents
  add constraint client_uploaded_documents_category_check check (category in (
    'a_verifier','identite','passeport','refus_ircc','formulaires_ircc','situation_financiere',
    'emploi_commerce','attaches_familiales','garant_financier','correspondance','acces_canada'
  )) not valid;

alter table public.client_uploaded_documents
  validate constraint client_uploaded_documents_category_check;

create index if not exists document_analyses_content_hash_idx
  on public.document_analyses ((extracted_fields->>'content_sha256'))
  where extracted_fields ? 'content_sha256';

create index if not exists client_uploads_manual_review_idx
  on public.client_uploaded_documents (client_id,created_at desc)
  where status='active' and category='a_verifier';

notify pgrst, 'reload schema';
