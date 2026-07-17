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

export function formatUsd(value: number | null | undefined) {
  return `${formatMoney(value)} US`;
}

export function formatProperName(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("fr-CA")
    .replace(/(^|[\s'-])([\p{L}])/gu, (_match, separator: string, letter: string) => `${separator}${letter.toLocaleUpperCase("fr-CA")}`);
}

export function formatCountryName(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.toLocaleLowerCase("fr-CA") === "canada" ? "Canada" : formatProperName(normalized);
}

export function formatPhoneNumber(value: string) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  const northAmerican = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (northAmerican.length === 10) {
    return `+1 ${northAmerican.slice(0, 3)}-${northAmerican.slice(3, 6)}-${northAmerican.slice(6)}`;
  }
  if (trimmed.startsWith("+") && digits.length >= 8) return `+${digits}`;
  return trimmed;
}
