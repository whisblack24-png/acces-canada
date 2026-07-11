export function formatDateFr(value?: string | Date | null) {
  if (!value) return "Non disponible";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Non disponible";

  return date.toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatDateFile(value: Date = new Date()) {
  return value.toISOString().slice(0, 10);
}

export function formatMoney(value: number | null | undefined) {
  return `${Number(value || 0).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} $`;
}
