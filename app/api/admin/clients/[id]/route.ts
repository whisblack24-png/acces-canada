import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import {
  adminErrorMessage,
  deleteClient,
  getClient,
  logSupabaseError,
  sanitizeClientInput,
  statusLabels,
  updateClient,
  validateClientInput,
} from "@/lib/admin-data";
import { formatMoney } from "@/lib/format";
import { notifyStatusChanged } from "@/lib/production-workflow";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

async function requireAdmin() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }

  return null;
}

export async function GET(_request: Request, context: Context) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await context.params;

  try {
    const client = await getClient(id);
    if (!client) {
      return NextResponse.json({ message: "Client introuvable." }, { status: 404 });
    }
    return NextResponse.json({ client });
  } catch (error) {
    logSupabaseError("Erreur lecture client", error);
    return NextResponse.json({ message: `Impossible de charger la fiche client. ${adminErrorMessage(error)}` }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: Context) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  const input = sanitizeClientInput(await request.json());
  const validationError = validateClientInput(input);
  if (validationError) {
    return NextResponse.json({ message: validationError }, { status: 400 });
  }

  try {
    const existing = await getClient(id);
    const changes = [
      existing?.status && existing.status !== input.status ? `Statut modifié: ${existing.status} -> ${input.status}.` : "",
      existing?.paid_amount !== undefined && Number(existing.paid_amount || 0) !== Number(input.paid_amount || 0)
        ? `Paiement mis à jour: ${formatMoney(Number(input.paid_amount || 0))}.`
        : "",
      existing?.documents_received?.join("|") !== input.documents_received?.join("|") ||
      existing?.documents_missing?.join("|") !== input.documents_missing?.join("|")
        ? "Liste documentaire mise à jour."
        : "",
    ].filter(Boolean);
    input.action_history = [
      ...(existing?.action_history || []),
      { date: new Date().toISOString(), action: changes.join(" ") || "Dossier client modifié dans le CRM." },
    ].slice(-100);
    const updated = await updateClient(id, input);
    if (existing?.status && existing.status !== input.status) {
      notifyStatusChanged(updated, statusLabels[input.status] || input.status).catch((error) => console.error("Notification statut non envoyée:", error));
    }
    return NextResponse.json({ client: updated });
  } catch (error) {
    logSupabaseError("Erreur modification client", error);
    return NextResponse.json({ message: `Impossible de modifier le client. ${adminErrorMessage(error)}` }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: Context) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await context.params;

  try {
    await deleteClient(id);
    return NextResponse.json({ message: "Client supprimé." });
  } catch (error) {
    logSupabaseError("Erreur suppression client", error);
    return NextResponse.json({ message: `Impossible de supprimer le client. ${adminErrorMessage(error)}` }, { status: 500 });
  }
}
