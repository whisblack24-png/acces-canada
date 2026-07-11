export type ConsultationType = "consultation_30" | "consultation_60";
export type ConsultationMode = "telephone" | "visioconference" | "en_personne";
export type AppointmentStatus = "confirmed" | "cancelled";

export type Appointment = {
  id: string;
  created_at: string;
  updated_at: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  stripe_session_id: string;
  stripe_payment_intent: string | null;
  booking_reference: string;
  invoice_number: string;
  status: AppointmentStatus;
  consultation_type: ConsultationType;
  duration_minutes: number;
  amount_cents: number;
  currency: string;
  client_first_name: string;
  client_last_name: string;
  client_full_name: string;
  client_email: string;
  client_phone: string;
  client_country: string;
  reason: string;
  consultation_mode: ConsultationMode;
  starts_at: string;
  ends_at: string;
  payment_method_label: string | null;
};

export const consultationTypes: Record<
  ConsultationType,
  { label: string; durationMinutes: number; amountCents: number; description: string }
> = {
  consultation_30: {
    label: "Consultation de 30 minutes",
    durationMinutes: 30,
    amountCents: 5000,
    description: "Un échange ciblé pour clarifier votre situation et définir la prochaine étape.",
  },
  consultation_60: {
    label: "Consultation de 60 minutes",
    durationMinutes: 60,
    amountCents: 10000,
    description: "Une analyse plus complète de votre projet avec recommandations personnalisées.",
  },
};

export const consultationModeLabels: Record<ConsultationMode, string> = {
  telephone: "Téléphone",
  visioconference: "Visioconférence",
  en_personne: "En personne",
};

export function formatDateTimeFr(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Date non disponible";

  return date.toLocaleString("fr-CA", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Toronto",
  });
}
