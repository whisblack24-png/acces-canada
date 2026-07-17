-- Accès Canada — état durable de finalisation du parcours Stripe.
-- Migration additive, idempotente et compatible avec les rendez-vous existants.

alter table if exists public.client_appointments
  add column if not exists fulfillment_status text not null default 'processing',
  add column if not exists fulfillment_completed_at timestamptz,
  add column if not exists confirmation_email_sent_at timestamptz,
  add column if not exists fulfillment_error text;

alter table if exists public.client_appointments
  drop constraint if exists client_appointments_fulfillment_status_check;

update public.client_appointments
set fulfillment_status = 'completed',
    fulfillment_completed_at = coalesce(fulfillment_completed_at, confirmed_at, updated_at, created_at),
    confirmation_email_sent_at = coalesce(confirmation_email_sent_at, confirmed_at, updated_at, created_at),
    fulfillment_error = null
where fulfillment_status is null
   or fulfillment_status not in ('processing', 'completed', 'failed')
   or (fulfillment_status = 'processing' and fulfillment_completed_at is null);

alter table if exists public.client_appointments
  add constraint client_appointments_fulfillment_status_check
  check (fulfillment_status in ('processing', 'completed', 'failed')) not valid;

alter table if exists public.client_appointments
  validate constraint client_appointments_fulfillment_status_check;

create index if not exists client_appointments_fulfillment_idx
  on public.client_appointments(fulfillment_status, created_at desc);

notify pgrst, 'reload schema';
