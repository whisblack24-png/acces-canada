import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { listAppointments } from "@/lib/booking";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "Accès non autorisé." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const appointments = await listAppointments({
    status: searchParams.get("status") || undefined,
    date: searchParams.get("date") || undefined,
    search: searchParams.get("search") || undefined,
  });

  return NextResponse.json({ appointments });
}
