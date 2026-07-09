import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import {
  adminErrorMessage,
  createClient,
  listClients,
  logSupabaseError,
  sanitizeClientInput,
  validateClientInput,
} from "@/lib/admin-data";

export const runtime = "nodejs";

async function requireAdmin() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }

  return null;
}

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    return NextResponse.json({ clients: await listClients() });
  } catch (error) {
    logSupabaseError("Erreur liste clients", error);
    return NextResponse.json({ message: `Impossible de charger les clients. ${adminErrorMessage(error)}` }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const input = sanitizeClientInput(await request.json());
  const validationError = validateClientInput(input);
  if (validationError) {
    return NextResponse.json({ message: validationError }, { status: 400 });
  }

  try {
    return NextResponse.json({ client: await createClient(input) }, { status: 201 });
  } catch (error) {
    logSupabaseError("Erreur création client", error);
    return NextResponse.json({ message: `Impossible de créer le client. ${adminErrorMessage(error)}` }, { status: 500 });
  }
}
