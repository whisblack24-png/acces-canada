import { NextResponse } from "next/server";
import { clearAdminSession } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST() {
  const response = clearAdminSession(NextResponse.json({ message: "Déconnexion réussie." }));
  const secure = process.env.ADMIN_COOKIE_SECURE === "false" ? "" : " Secure;";

  response.headers.append(
    "Set-Cookie",
    `acces_canada_admin=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax;${secure}`,
  );
  response.headers.append(
    "Set-Cookie",
    `acces_canada_admin=; Path=/admin; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax;${secure}`,
  );

  return response;
}
