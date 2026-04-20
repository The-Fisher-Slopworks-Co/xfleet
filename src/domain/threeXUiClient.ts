// src/domain/threeXUiClient.ts
export type PanelServer = {
  name: string; host: string; port: number; web_base_path: string;
  username: string; password: string; use_tls: boolean;
};

export type ClientError =
  | { kind: "auth_failed" }
  | { kind: "no_cookie" }
  | { kind: "unexpected_status"; status: number }
  | { kind: "connection_failed" }
  | { kind: "api_error"; msg: string };

export type LoginResult = { ok: true; cookie: string } | { ok: false; error: ClientError };
export type InboundsResult = { ok: true; inbounds: any[] } | { ok: false; error: ClientError };

export function baseUrl(s: PanelServer): string {
  const scheme = s.use_tls ? "https" : "http";
  const path = s.web_base_path && s.web_base_path !== "/" ? s.web_base_path : "";
  return `${scheme}://${s.host}:${s.port}${path}`;
}

export async function login(s: PanelServer): Promise<LoginResult> {
  const body = new URLSearchParams({ username: s.username, password: s.password });
  let res: Response;
  try {
    res = await fetch(`${baseUrl(s)}/login`, {
      method: "POST",
      body,
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return { ok: false, error: { kind: "connection_failed" } };
  }
  if (res.status !== 200) return { ok: false, error: { kind: "unexpected_status", status: res.status } };
  let parsed: any;
  try { parsed = await res.json(); } catch { return { ok: false, error: { kind: "unexpected_status", status: res.status } }; }
  if (!parsed?.success) return { ok: false, error: { kind: "auth_failed" } };
  const cookie = extractCookie(res.headers);
  return cookie ? { ok: true, cookie } : { ok: false, error: { kind: "no_cookie" } };
}

export async function listInbounds(s: PanelServer, cookie: string): Promise<InboundsResult> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl(s)}/panel/api/inbounds/list`, {
      headers: { cookie, accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return { ok: false, error: { kind: "connection_failed" } };
  }
  if (res.status !== 200) return { ok: false, error: { kind: "unexpected_status", status: res.status } };
  let parsed: any;
  try { parsed = await res.json(); } catch { return { ok: false, error: { kind: "unexpected_status", status: res.status } }; }
  if (parsed?.success === true) return { ok: true, inbounds: parsed.obj ?? [] };
  if (parsed?.success === false) return { ok: false, error: { kind: "api_error", msg: String(parsed.msg ?? "") } };
  return { ok: false, error: { kind: "unexpected_status", status: res.status } };
}

function extractCookie(headers: Headers): string | null {
  // Bun's fetch exposes set-cookie via getSetCookie() in newer versions; fallback to .get
  const list = (headers as any).getSetCookie?.() ?? (headers.get("set-cookie") ? [headers.get("set-cookie") as string] : []);
  const tokens = list.map((c: string) => c.split(";")[0]!.trim()).filter(Boolean);
  return tokens.length ? tokens.join("; ") : null;
}
