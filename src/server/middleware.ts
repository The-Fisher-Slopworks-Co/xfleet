// src/server/middleware.ts
import type { Env } from "./env";
import { readSessionCookie, verifySession, type SessionPayload } from "./session";
import { unauthorized } from "./http";

export function requireAuth(req: Request, env: Env): SessionPayload | Response {
  const cookie = readSessionCookie(req.headers.get("cookie"));
  const session = verifySession(cookie, env.sessionSecret);
  if (!session || session.u !== env.adminUsername) return unauthorized();
  return session;
}
