// src/server/session.ts
import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type SessionPayload = { u: string; iat: number };

export function issueSession(username: string, secret: string, opts: { iat?: number } = {}): { cookie: string; value: string } {
  const iat = opts.iat ?? Math.floor(Date.now() / 1000);
  const payloadB64 = Buffer.from(JSON.stringify({ u: username, iat })).toString("base64url");
  const mac = hmac(payloadB64, secret);
  const value = `${payloadB64}.${mac}`;
  const cookie = `xfleet_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${MAX_AGE_SECONDS}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
  return { cookie, value };
}

export function clearSessionCookie(): string {
  return `xfleet_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

export function verifySession(value: string | null | undefined, secret: string): SessionPayload | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, mac] = parts as [string, string];
  const expected = hmac(payloadB64, secret);
  const a = Buffer.from(mac, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString()) as SessionPayload;
    if (typeof payload.u !== "string" || typeof payload.iat !== "number") return null;
    if (Math.floor(Date.now() / 1000) - payload.iat > MAX_AGE_SECONDS) return null;
    return payload;
  } catch {
    return null;
  }
}

export function readSessionCookie(header: string | null): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === "xfleet_session") return rest.join("=");
  }
  return null;
}

function hmac(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}
