// src/domain/extSubFetcher.ts

export type FetchError =
  | { kind: "connection_failed" }
  | { kind: "unexpected_status"; status: number }
  | { kind: "empty_body" };

export type FetchResult =
  | { ok: true; body: string }
  | { ok: false; error: FetchError };

export type FetchHeaders = {
  user_agent: string;
  app_version: string;
  device_model: string;
  ver_os: string;
  device_os: string;
  hwid: string;
};

export async function fetchSubscription(url: string, h: FetchHeaders): Promise<FetchResult> {
  const headers: Record<string, string> = {
    accept: "*/*",
    "accept-encoding": "gzip, deflate, br",
    "accept-language": "en-US,en;q=0.9",
  };
  if (h.user_agent)   headers["user-agent"]    = h.user_agent;
  if (h.app_version)  headers["x-app-version"]  = h.app_version;
  if (h.device_model) headers["x-device-model"] = h.device_model;
  if (h.ver_os)       headers["x-ver-os"]       = h.ver_os;
  if (h.device_os)    headers["x-device-os"]    = h.device_os;
  if (h.hwid)         headers["x-hwid"]         = h.hwid;

  let res: Response;
  try {
    res = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) });
  } catch {
    return { ok: false, error: { kind: "connection_failed" } };
  }
  if (res.status !== 200) return { ok: false, error: { kind: "unexpected_status", status: res.status } };
  let body: string;
  try {
    body = await res.text();
  } catch {
    return { ok: false, error: { kind: "connection_failed" } };
  }
  if (!body.trim()) return { ok: false, error: { kind: "empty_body" } };
  return { ok: true, body };
}
