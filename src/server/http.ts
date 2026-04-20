// src/server/http.ts
export function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers || {}) },
  });
}

export function text(body: string, init: ResponseInit = {}): Response {
  return new Response(body, {
    ...init,
    headers: { "content-type": "text/plain; charset=utf-8", ...(init.headers || {}) },
  });
}

export function noContent(): Response {
  return new Response(null, { status: 204 });
}

export function badRequest(errors: Record<string, string[]>): Response {
  return json({ errors }, { status: 422 });
}

export function unauthorized(): Response {
  return json({ error: "unauthorized" }, { status: 401 });
}

export function notFound(): Response {
  return json({ error: "not_found" }, { status: 404 });
}

export function serverError(message = "internal_error"): Response {
  return json({ error: message }, { status: 500 });
}

export async function readJson<T>(req: Request): Promise<T> {
  return (await req.json()) as T;
}

import type { ZodIssue } from "zod";
export function zodToErrors(issues: ZodIssue[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const i of issues) {
    const key = i.path.join(".") || "_";
    (out[key] ||= []).push(i.message);
  }
  return out;
}
