// src/domain/linkBuilder.ts
export type Inbound = {
  protocol: string;
  port: number;
  listen?: string | null;
  streamSettings?: string | Record<string, unknown>;
  remark?: string;
  settings?: string;
};

export type Client = {
  id: string;
  email?: string;
  enable?: boolean;
  flow?: string;
};

export type BuildResult =
  | { ok: true; link: string }
  | { ok: false; error: "unsupported_protocol" | "invalid_json" };

export function buildVlessLink(host: string, inbound: Inbound, client: Client): BuildResult {
  if (inbound.protocol !== "vless") return { ok: false, error: "unsupported_protocol" };
  const stream = parseMaybeJson(inbound.streamSettings);
  if (stream === null) return { ok: false, error: "invalid_json" };

  const address = resolveAddress(host, inbound.listen ?? null);
  const params: Record<string, string> = {};

  putTransport(params, stream);
  putSecurity(params, stream, client);

  const query = encodeParams(params);
  return { ok: true, link: `vless://${client.id}@${address}:${inbound.port}?${query}` };
}

function resolveAddress(fallback: string, listen: string | null): string {
  if (listen === null || listen === undefined) return fallback;
  if (listen === "" || listen === "0.0.0.0" || listen === "::" || listen === "::0") return fallback;
  return listen;
}

function parseMaybeJson(v: unknown): Record<string, any> | null {
  if (v && typeof v === "object") return v as Record<string, any>;
  if (typeof v !== "string") return {};
  if (v === "") return {};
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

function putTransport(p: Record<string, string>, stream: Record<string, any>): void {
  const network = (stream.network as string) || "tcp";
  p.type = network;
  switch (network) {
    case "tcp":
      addTcp(p, stream.tcpSettings || {});
      break;
    case "ws":
      addWs(p, stream.wsSettings || {});
      break;
    case "grpc":
      addGrpc(p, stream.grpcSettings || {});
      break;
    case "httpupgrade":
      addHttpUpgrade(p, stream.httpupgradeSettings || {});
      break;
    case "xhttp":
      addXhttp(p, stream.xhttpSettings || {});
      break;
    case "kcp":
      addKcp(p, stream.kcpSettings || {});
      break;
  }
}

function addTcp(p: Record<string, string>, tcp: Record<string, any>): void {
  const header = tcp.header || {};
  const headerType = header.type || "none";
  p.headerType = headerType;
  if (headerType === "http") {
    const request = header.request || {};
    const path = firstOf(request.path);
    const hostHeader = firstOf(request.headers?.Host);
    maybePut(p, "path", path);
    maybePut(p, "host", hostHeader);
  }
}

function addWs(p: Record<string, string>, ws: Record<string, any>): void {
  maybePut(p, "path", ws.path);
  maybePut(p, "host", ws.host ?? ws.headers?.Host);
}

function addGrpc(p: Record<string, string>, grpc: Record<string, any>): void {
  maybePut(p, "serviceName", grpc.serviceName);
  maybePut(p, "authority", grpc.authority);
  if (grpc.multiMode) p.mode = "multi";
}

function addHttpUpgrade(p: Record<string, string>, hu: Record<string, any>): void {
  maybePut(p, "path", hu.path);
  maybePut(p, "host", hu.host ?? hu.headers?.Host);
}

function addXhttp(p: Record<string, string>, xh: Record<string, any>): void {
  maybePut(p, "path", xh.path);
  maybePut(p, "host", xh.host ?? xh.headers?.Host);
  maybePut(p, "mode", xh.mode);
}

function addKcp(p: Record<string, string>, kcp: Record<string, any>): void {
  const headerType = kcp.header?.type || "none";
  p.headerType = headerType;
  maybePut(p, "seed", kcp.seed);
}

function putSecurity(p: Record<string, string>, stream: Record<string, any>, client: Client): void {
  const security = (stream.security as string) || "none";
  const network = (stream.network as string) || "tcp";
  p.security = security;
  if (security === "tls") {
    const tls = stream.tlsSettings || {};
    maybePut(p, "sni", tls.serverName);
    const alpn = Array.isArray(tls.alpn) ? tls.alpn.join(",") : "";
    maybePut(p, "alpn", alpn === "" ? undefined : alpn);
    maybePut(p, "fp", tls.settings?.fingerprint);
    if (network === "tcp") maybePut(p, "flow", nonEmpty(client.flow));
  } else if (security === "reality") {
    const reality = stream.realitySettings || {};
    const serverNames: string[] = reality.serverNames || [];
    const shortIds: string[] = reality.shortIds || [];
    const sni = pick(serverNames, client.id);
    const sid = pick(shortIds, client.id);
    maybePut(p, "sni", nonEmpty(sni));
    maybePut(p, "pbk", reality.settings?.publicKey);
    maybePut(p, "sid", nonEmpty(sid));
    maybePut(p, "fp", reality.settings?.fingerprint);
    maybePut(p, "spx", reality.settings?.spiderX);
    if (network === "tcp") maybePut(p, "flow", nonEmpty(client.flow));
  }
}

function firstOf(v: unknown): string | undefined {
  if (Array.isArray(v)) return v[0] as string | undefined;
  if (typeof v === "string") return v;
  return undefined;
}

function maybePut(p: Record<string, string>, key: string, value: unknown): void {
  if (value === null || value === undefined || value === "") return;
  p[key] = String(value);
}

function nonEmpty(s: string | undefined | null): string | undefined {
  if (!s) return undefined;
  return s;
}

// FNV-1a 32-bit; deterministic substitute for :erlang.phash2 bucketing
function stableHash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

function pick<T>(arr: T[], key: string): T | "" {
  if (arr.length === 0) return "";
  const idx = stableHash(key) % arr.length;
  return arr[idx]!;
}

// RFC 3986 encoding: encodeURIComponent plus ! ' ( ) * ~
function rfc3986(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*~]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

function encodeParams(p: Record<string, string>): string {
  return Object.keys(p)
    .sort()
    .map(k => `${rfc3986(k)}=${rfc3986(p[k]!)}`)
    .join("&");
}
