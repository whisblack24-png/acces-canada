import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit, requestIp } from "@/lib/rate-limit";
import { createQuestionnaireSession, resolveAccessToken, SESSION_COOKIE } from "@/lib/questionnaires";

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const rate = checkRateLimit(`questionnaire-link:${requestIp(request)}`, 30, 15 * 60_000);
  if (!rate.allowed) return new NextResponse("Trop de tentatives.", { status: 429, headers: { "Retry-After": String(rate.retryAfter) } });
  const { token } = await params;
  const link = await resolveAccessToken(token).catch(() => null);
  if (!link) return NextResponse.redirect(new URL("/questionnaire/lien-invalide", request.url));
  const response = NextResponse.redirect(new URL("/questionnaire", request.url));
  response.cookies.set(SESSION_COOKIE, createQuestionnaireSession(link.questionnaire_id, link.expires_at), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: new Date(link.expires_at) });
  return response;
}
