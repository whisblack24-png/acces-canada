-- Réservations payées, factures et suivi des consultations Accès Canada.
create extension if not exists pgcrypto;

create table if not exists public.client_appointments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz default now(),
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  stripe_session_id text not null unique,
  stripe_payment_intent text,
  booking_reference text not null unique,
  invoice_number text not null unique,
  status text not null default 'confirmed',
  consultation_type text not null,
  duration_minutes integer not null,
  amount_cents integer not null,
  currency text not null default 'USD',
  client_first_name text not null,
  client_last_name text not null,
  client_full_name text not null,
  client_email text not null,
  client_phone text not null,
  client_country text not null,
  reason text not null,
  consultation_mode text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  payment_method_label text,
  constraint client_appointments_status_check check (status in ('confirmed', 'cancelled')),
  constraint client_appointments_type_check check (consultation_type in ('consultation_30', 'consultation_60')),
  constraint client_appointments_mode_check check (consultation_mode in ('telephone', 'visioconference', 'en_personne')),
  constraint client_appointments_amount_check check (amount_cents in (5000, 10000)),
  constraint client_appointments_duration_check check (duration_minutes in (30, 60))
);

create unique index if not exists client_appointments_confirmed_slot_unique
on public.client_appointments (starts_at)
where status = 'confirmed';

create index if not exists client_appointments_email_idx
on public.client_appointments (lower(client_email));

create index if not exists client_appointments_status_date_idx
on public.client_appointments (status, starts_at);

create or replace function public.set_client_appointments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_client_appointments_updated_at on public.client_appointments;
create trigger set_client_appointments_updated_at
before update on public.client_appointments
for each row
execute function public.set_client_appointments_updated_at();

comment on table public.client_appointments is 'Rendez-vous payés et confirmés avec facture Accès Canada.';

notify pgrst, 'reload schema';
