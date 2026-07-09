import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { deleteClient, getClient, sanitizeClientInput, updateClient, validateClientInput } from "@/lib/admin-data";

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
    console.error("Erreur lecture client:", error);
    return NextResponse.json({ message: "Impossible de charger la fiche client." }, { status: 500 });
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
    return NextResponse.json({ client: await updateClient(id, input) });
  } catch (error) {
    console.error("Erreur modification client:", error);
    return NextResponse.json({ message: "Impossible de modifier le client." }, { status: 500 });
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
    console.error("Erreur suppression client:", error);
    return NextResponse.json({ message: "Impossible de supprimer le client." }, { status: 500 });
  }
}
