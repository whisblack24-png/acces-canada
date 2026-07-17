-- Accès Canada - métadonnées d'annulation des rendez-vous.
-- Migration additive et idempotente; aucune donnée existante n'est supprimée.

alter table if exists public.client_appointments
  add column if not exists cancellation_reason text;

notify pgrst, 'reload schema';
