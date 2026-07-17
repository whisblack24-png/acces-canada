-- Index couvrants recommandés par le conseiller de performance Supabase.
create index if not exists document_analyses_reviewed_by_idx on public.document_analyses(reviewed_by);
create index if not exists julie_approval_requests_client_idx on public.julie_approval_requests(client_id);
create index if not exists julie_approval_requests_requested_by_idx on public.julie_approval_requests(requested_by);
create index if not exists julie_approval_requests_reviewed_by_idx on public.julie_approval_requests(reviewed_by);
create index if not exists julie_conversations_client_idx on public.julie_conversations(client_id,updated_at desc);
