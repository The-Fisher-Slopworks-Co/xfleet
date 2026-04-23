// src/server/clientIp.ts
import type { Server } from "bun";
import type { Env } from "./env";

const SENSITIVE_HEADERS = new Set(["cookie", "authorization", "proxy-authorization"]);
const IP_SHAPE = /^[0-9a-fA-F:.]{2,45}$/;
const MAX_HEADER_VALUE_LEN = 1024;
const MAX_HEADER_COUNT = 64;

export const MAX_USER_AGENT_LEN = 1024;
export const MAX_TOKEN_LEN = 512;

function sanitizeIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return IP_SHAPE.test(ip) ? ip : null;
}

export function clientIp(req: Request, server: Server<unknown> | null, env: Env): string | null {
  if (env.trustProxy) {
    const xff = req.headers.get("x-forwarded-for");
    if (xff) {
      const first = xff.split(",")[0]?.trim();
      const sane = sanitizeIp(first);
      if (sane) return sane;
    }
  }
  return sanitizeIp(server?.requestIP(req)?.address);
}

export function headersToRecord(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  let count = 0;
  for (const [k, v] of req.headers.entries()) {
    if (SENSITIVE_HEADERS.has(k.toLowerCase())) continue;
    if (count++ >= MAX_HEADER_COUNT) break;
    out[k] = v.length > MAX_HEADER_VALUE_LEN ? v.slice(0, MAX_HEADER_VALUE_LEN) : v;
  }
  return out;
}

export function truncate(s: string | null, max: number): string | null {
  if (s === null) return null;
  return s.length > max ? s.slice(0, max) : s;
}
