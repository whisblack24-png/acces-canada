-- Correction devise: tout le système de réservation et de paiement utilise USD.
alter table if exists public.client_appointments
alter column currency set default 'USD';

update public.client_appointments
set currency = 'USD'
where upper(currency) = 'CAD';

alter table if exists public.client_payments
alter column currency set default 'usd';

update public.client_payments
set currency = 'usd'
where lower(currency) = 'cad';

notify pgrst, 'reload schema';
