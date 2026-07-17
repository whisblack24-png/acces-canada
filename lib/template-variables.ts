import type { AdminClient } from "@/lib/admin-data";

export function clientTemplateVariables(client: AdminClient, now = new Date()): Record<string, string> {
  const names = client.full_name.trim().split(/\s+/);
  return {
    client_nom: client.full_name,
    client_prenom: names[0] || client.full_name,
    client_email: client.email,
    client_telephone: client.phone || "",
    client_pays: client.country || "",
    numero_dossier: client.file_reference || "",
    type_dossier: client.service.replaceAll("_", " "),
    statut_dossier: client.status.replaceAll("_", " "),
    date_document: now.toLocaleDateString("fr-CA"),
    date_du_jour: now.toLocaleDateString("fr-CA"),
    montant_paye: Number(client.paid_amount || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" }),
  };
}

export function replaceTemplateVariables(template: string, variables: Record<string, unknown>) {
  const missing = new Set<string>();
  const content = template.replace(/\{\{\s*([\p{L}\p{N}_-]+)\s*\}\}/gu, (token, key: string) => {
    const value = variables[key];
    if (value === undefined || value === null || value === "") { missing.add(key); return `[À COMPLÉTER : ${key.replaceAll("_", " ")}]`; }
    return String(value);
  });
  return { content, missing: [...missing] };
}
