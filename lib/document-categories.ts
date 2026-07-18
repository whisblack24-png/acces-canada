export const DOCUMENT_CATEGORIES = [
  { value: "a_verifier", label: "Document à vérifier" },
  { value: "identite", label: "Identité" },
  { value: "passeport", label: "Passeport" },
  { value: "refus_ircc", label: "Refus IRCC" },
  { value: "formulaires_ircc", label: "Formulaires IRCC" },
  { value: "situation_financiere", label: "Situation financière" },
  { value: "emploi_commerce", label: "Documents d’emploi / commerce" },
  { value: "attaches_familiales", label: "Attaches familiales" },
  { value: "garant_financier", label: "Garant financier" },
  { value: "correspondance", label: "Correspondance" },
  { value: "acces_canada", label: "Documents générés par Accès Canada" },
] as const;

export const DOCUMENT_CATEGORY_VALUES = new Set<string>(DOCUMENT_CATEGORIES.map((item) => item.value));
export function documentCategoryLabel(value: string) {
  return DOCUMENT_CATEGORIES.find((item) => item.value === value)?.label || value || "Non classé";
}

export const DOCUMENT_MIME_TYPES = [
  "application/pdf", "image/jpeg", "image/png", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain", "text/csv", "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;
export const DOCUMENT_CATEGORY_LABELS: Record<string,string> = Object.fromEntries(DOCUMENT_CATEGORIES.map((item)=>[item.value,item.label]));
export const DOCUMENT_ACCEPT = ".pdf,.jpg,.jpeg,.png,.doc,.docx,.txt,.csv,.xls,.xlsx";
export const DOCUMENT_MAX_SIZE = 15 * 1024 * 1024;
