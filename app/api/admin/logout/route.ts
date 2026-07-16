import { NextResponse } from "next/server";
import { clearAdminSession, getAdminIdentity } from "@/lib/admin-auth";
import { createAuditLog } from "@/lib/platform-v2";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const identity=await getAdminIdentity();
  await createAuditLog({ actorId:identity?.id, action:"logout", entityType:"admin_session", summary:`Déconnexion · ${identity?.name||"administrateur"}`, userAgent:request.headers.get("user-agent")||undefined }).catch((error)=>console.error("[audit] déconnexion",error));
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
