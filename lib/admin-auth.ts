import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "acces_canada_admin";

const maxAgeSeconds = 60 * 60 * 8;

function getSecret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || "change-this-admin-secret";
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
  return process.env.VERCEL === "1" || process.env.VERCEL === "true";
}

export function verifyAdminPassword(password: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return false;
  }
  return safeEqual(password, expected);
}

export function createAdminSessionValue() {
  const expiresAt = Date.now() + maxAgeSeconds * 1000;
  const payload = `admin:${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

export async function isAdminAuthenticated() {
  const store = await cookies();
  const session = store.get(ADMIN_COOKIE)?.value;
  if (!session) {
    return false;
  }

  const [role, expiresAt, signature] = session.split(/[.:]/);
  if (role !== "admin" || !expiresAt || !signature) {
    return false;
  }

  if (Number(expiresAt) < Date.now()) {
    return false;
  }

  return safeEqual(signature, sign(`${role}:${expiresAt}`));
}

export async function setAdminSession() {
  const store = await cookies();
  store.set(ADMIN_COOKIE, createAdminSessionValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: useSecureCookie(),
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

export async function clearAdminSession() {
  const store = await cookies();
  store.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: useSecureCookie(),
    path: "/",
    maxAge: 0,
  });
}
