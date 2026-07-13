import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const CLIENT_COOKIE = "acces_canada_client";
const maxAgeSeconds = 60 * 60 * 6;

function secret() {
  const value = process.env.CLIENT_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (!value) throw new Error("Configuration de session client manquante.");
  return value;
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

function encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function secureCookie() {
  if (process.env.CLIENT_COOKIE_SECURE === "false") return false;
  if (process.env.CLIENT_COOKIE_SECURE === "true") return true;
  return process.env.NODE_ENV === "production";
}

export function createClientCode() {
  return String(randomInt(100000, 1000000));
}

export function hashClientCode(email: string, code: string) {
  return createHmac("sha256", secret()).update(`${email.toLowerCase()}:${code}`).digest("hex");
}

export function createClientSessionValue(clientId: string, email: string) {
  const expiresAt = Date.now() + maxAgeSeconds * 1000;
  const payload = encode(JSON.stringify({ role: "client", clientId, email: email.toLowerCase(), expiresAt }));
  return `${payload}.${sign(payload)}`;
}

export function verifyClientSessionValue(value: string | undefined) {
  if (!value) return null;
  const separator = value.lastIndexOf(".");
  if (separator <= 0) return null;
  const payload = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  if (!payload || !signature || !safeEqual(signature, sign(payload))) return null;

  try {
    const parsed = JSON.parse(decode(payload)) as { role?: string; clientId?: string; email?: string; expiresAt?: number };
    if (parsed.role !== "client" || !parsed.clientId || !parsed.email || Number(parsed.expiresAt) <= Date.now()) return null;
    return { clientId: parsed.clientId, email: parsed.email };
  } catch {
    return null;
  }
}

export async function getClientSession() {
  const store = await cookies();
  return verifyClientSessionValue(store.get(CLIENT_COOKIE)?.value);
}

export function setClientSession(response: NextResponse, clientId: string, email: string) {
  response.cookies.set(CLIENT_COOKIE, createClientSessionValue(clientId, email), {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookie(),
    path: "/",
    maxAge: maxAgeSeconds,
  });
  return response;
}

export function clearClientSession(response: NextResponse) {
  response.cookies.set(CLIENT_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookie(),
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
  return response;
}
