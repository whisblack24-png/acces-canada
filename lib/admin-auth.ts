import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const ADMIN_COOKIE = "acces_canada_admin";

const maxAgeSeconds = 60 * 60 * 8;

function getSecret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || "";
}

export function getAdminConfigurationError() {
  const missing = ["ADMIN_PASSWORD"].filter((name) => !process.env[name]);
  return missing.length ? `Configuration administration incomplète: ${missing.join(", ")}.` : null;
}

function sign(value: string) {
  return createHmac("sha256", getSecret()).update(value).digest("hex");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function useSecureCookie() {
  if (process.env.ADMIN_COOKIE_SECURE === "false") {
    return false;
  }

  if (process.env.ADMIN_COOKIE_SECURE === "true") {
    return true;
  }

  return process.env.NODE_ENV === "production";
}

function encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function verifyAdminPassword(password: string) {
  if (getAdminConfigurationError()) return false;
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return false;
  }
  return safeEqual(password, expected);
}

export function createAdminSessionValue() {
  const expiresAt = Date.now() + maxAgeSeconds * 1000;
  const payload = encode(JSON.stringify({ role: "admin", expiresAt }));
  return `${payload}.${sign(payload)}`;
}

export function verifyAdminSessionValue(session: string | undefined) {
  if (!session) {
    return false;
  }

  const separator = session.lastIndexOf(".");
  if (separator <= 0) {
    return verifyLegacySessionValue(session);
  }

  const payload = session.slice(0, separator);
  const signature = session.slice(separator + 1);

  if (!payload || !signature || !safeEqual(signature, sign(payload))) {
    return false;
  }

  try {
    const parsed = JSON.parse(decode(payload)) as { role?: string; expiresAt?: number };
    return parsed.role === "admin" && Number(parsed.expiresAt) > Date.now();
  } catch {
    return false;
  }
}

function verifyLegacySessionValue(session: string) {
  const separator = session.lastIndexOf(".");
  if (separator <= 0) {
    return false;
  }

  const payload = session.slice(0, separator);
  const signature = session.slice(separator + 1);
  const [role, expiresAt] = payload.split(":");

  if (role !== "admin" || !expiresAt || !signature || Number(expiresAt) < Date.now()) {
    return false;
  }

  return safeEqual(signature, sign(payload));
}

export async function isAdminAuthenticated() {
  const store = await cookies();
  const session = store.get(ADMIN_COOKIE)?.value;
  return verifyAdminSessionValue(session);
}

export function setAdminSession(response: NextResponse) {
  response.cookies.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: useSecureCookie(),
    path: "/admin",
    maxAge: 0,
    expires: new Date(0),
  });

  response.cookies.set(ADMIN_COOKIE, createAdminSessionValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: useSecureCookie(),
    path: "/",
    maxAge: maxAgeSeconds,
  });
  return response;
}

export function clearAdminSession(response: NextResponse) {
  for (const path of ["/", "/admin"]) {
    response.cookies.set(ADMIN_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: useSecureCookie(),
      path,
      maxAge: 0,
      expires: new Date(0),
    });
  }
  return response;
}
