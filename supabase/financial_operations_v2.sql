-- Accès Canada V2 — finances et comptabilité opérationnelle.
-- Migration additive, idempotente et sans modification des paiements existants.

create extension if not exists pgcrypto;

create table if not exists public.finance_settings (
  id text primary key default 'default' check (id = 'default'),
  usd_to_cad numeric(12,6) not null default 1.35 check (usd_to_cad > 0),
  stripe_fee_percent numeric(7,4) not null default 2.9 check (stripe_fee_percent >= 0),
  stripe_fee_fixed_cents integer not null default 30 check (stripe_fee_fixed_cents >= 0),
  updated_at timestamptz not null default now(),
  updated_by text not null default 'system'
);

insert into public.finance_settings(id) values ('default') on conflict (id) do nothing;

create table if not exists public.finance_expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null default current_date,
  category text not null,
  description text not null,
  vendor text,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'cad' check (currency in ('usd','cad')),
  usd_to_cad numeric(12,6) check (usd_to_cad is null or usd_to_cad > 0),
  status text not null default 'recorded' check (status in ('recorded','void')),
  receipt_reference text,
  created_at timestamptz not null default now(),
  created_by text not null default 'administrateur',
  updated_at timestamptz not null default now()
);

alter table public.client_appointments add column if not exists stripe_fee_cents integer;
alter table public.client_appointments add column if not exists net_amount_cents integer;
alter table public.client_appointments add column if not exists stripe_settlement_currency text;
alter table public.client_appointments add column if not exists stripe_settlement_gross_cents integer;
alter table public.client_appointments add column if not exists stripe_settlement_fee_cents integer;
alter table public.client_appointments add column if not exists stripe_settlement_net_cents integer;
alter table public.client_appointments add column if not exists stripe_exchange_rate numeric(18,8);
alter table public.client_appointments add column if not exists stripe_refunded_cents integer not null default 0;
alter table public.client_payments add column if not exists stripe_fee_cents integer;
alter table public.client_payments add column if not exists net_amount_cents integer;

create index if not exists finance_expenses_date_idx on public.finance_expenses(expense_date desc);
create index if not exists finance_expenses_status_idx on public.finance_expenses(status, expense_date desc);

alter table public.finance_settings enable row level security;
alter table public.finance_expenses enable row level security;
revoke all on public.finance_settings, public.finance_expenses from anon, authenticated;
grant all on public.finance_settings, public.finance_expenses to service_role;

drop policy if exists service_role_finance_settings on public.finance_settings;
create policy service_role_finance_settings on public.finance_settings for all to service_role using (true) with check (true);
drop policy if exists service_role_finance_expenses on public.finance_expenses;
create policy service_role_finance_expenses on public.finance_expenses for all to service_role using (true) with check (true);

create or replace function public.set_finance_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;
revoke all on function public.set_finance_updated_at() from public, anon, authenticated;
grant execute on function public.set_finance_updated_at() to service_role;
drop trigger if exists set_finance_settings_updated_at on public.finance_settings;
create trigger set_finance_settings_updated_at before update on public.finance_settings for each row execute function public.set_finance_updated_at();
drop trigger if exists set_finance_expenses_updated_at on public.finance_expenses;
create trigger set_finance_expenses_updated_at before update on public.finance_expenses for each row execute function public.set_finance_updated_at();

notify pgrst, 'reload schema';
