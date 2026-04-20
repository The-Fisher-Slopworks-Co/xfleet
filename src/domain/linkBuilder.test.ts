// src/domain/linkBuilder.test.ts
import { test, expect } from "bun:test";
import { buildVlessLink } from "./linkBuilder";

const UUID = "11111111-2222-3333-4444-555555555555";

function vless(inbound: Record<string, unknown>, client: Record<string, unknown> = { id: UUID }, host = "example.com") {
  const result = buildVlessLink(host, inbound as any, client as any);
  if (!result.ok) throw new Error(`expected ok, got ${result.error}`);
  return result.link;
}

test("non-vless protocol returns unsupported_protocol", () => {
  const r = buildVlessLink("h", { protocol: "trojan" } as any, { id: UUID } as any);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error).toBe("unsupported_protocol");
});

test("tcp default (no header, security none)", () => {
  const link = vless({
    protocol: "vless",
    port: 443,
    streamSettings: JSON.stringify({ network: "tcp", security: "none", tcpSettings: {} }),
  });
  expect(link).toBe(
    `vless://${UUID}@example.com:443?headerType=none&security=none&type=tcp`,
  );
});

test("tcp with http header includes path and host", () => {
  const link = vless({
    protocol: "vless",
    port: 80,
    streamSettings: JSON.stringify({
      network: "tcp",
      security: "none",
      tcpSettings: { header: { type: "http", request: { path: ["/ws"], headers: { Host: ["example.org"] } } } },
    }),
  });
  expect(link.includes("headerType=http")).toBe(true);
  expect(link.includes("path=%2Fws")).toBe(true);
  expect(link.includes("host=example.org")).toBe(true);
});

test("ws transport includes path and host", () => {
  const link = vless({
    protocol: "vless",
    port: 8080,
    streamSettings: JSON.stringify({ network: "ws", security: "none", wsSettings: { path: "/abc", host: "h.example" } }),
  });
  expect(link.includes("type=ws")).toBe(true);
  expect(link.includes("path=%2Fabc")).toBe(true);
  expect(link.includes("host=h.example")).toBe(true);
});

test("tls security adds sni, alpn, fp, and flow on tcp", () => {
  const link = vless(
    {
      protocol: "vless",
      port: 443,
      streamSettings: JSON.stringify({
        network: "tcp",
        security: "tls",
        tlsSettings: {
          serverName: "sni.example",
          alpn: ["h2", "http/1.1"],
          settings: { fingerprint: "chrome" },
        },
        tcpSettings: {},
      }),
    },
    { id: UUID, flow: "xtls-rprx-vision" },
  );
  expect(link.includes("sni=sni.example")).toBe(true);
  expect(link.includes("alpn=h2%2Chttp%2F1.1")).toBe(true);
  expect(link.includes("fp=chrome")).toBe(true);
  expect(link.includes("flow=xtls-rprx-vision")).toBe(true);
});

test("reality security picks deterministic sni/sid", () => {
  const link = vless({
    protocol: "vless",
    port: 443,
    streamSettings: JSON.stringify({
      network: "tcp",
      security: "reality",
      realitySettings: {
        serverNames: ["a.example", "b.example"],
        shortIds: ["deadbeef", "cafebabe"],
        settings: { publicKey: "PBK", fingerprint: "chrome", spiderX: "/" },
      },
      tcpSettings: {},
    }),
  });
  expect(link.includes("pbk=PBK")).toBe(true);
  expect(link.includes("sni=")).toBe(true);
  expect(link.includes("sid=")).toBe(true);
  // deterministic: repeat
  const link2 = vless({
    protocol: "vless",
    port: 443,
    streamSettings: JSON.stringify({
      network: "tcp",
      security: "reality",
      realitySettings: {
        serverNames: ["a.example", "b.example"],
        shortIds: ["deadbeef", "cafebabe"],
        settings: { publicKey: "PBK", fingerprint: "chrome", spiderX: "/" },
      },
      tcpSettings: {},
    }),
  });
  expect(link).toBe(link2);
});

test("fallback address uses host when listen is empty/0.0.0.0", () => {
  for (const listen of ["", "0.0.0.0", "::", "::0", null, undefined]) {
    const link = vless({
      protocol: "vless",
      port: 1,
      listen,
      streamSettings: JSON.stringify({ network: "tcp", security: "none", tcpSettings: {} }),
    });
    expect(link.includes("@example.com:1")).toBe(true);
  }
});

test("non-fallback listen address is used directly", () => {
  const link = vless({
    protocol: "vless",
    port: 1,
    listen: "10.0.0.2",
    streamSettings: JSON.stringify({ network: "tcp", security: "none", tcpSettings: {} }),
  });
  expect(link.includes("@10.0.0.2:1")).toBe(true);
});

test("grpc transport includes serviceName and multi mode", () => {
  const link = vless({
    protocol: "vless",
    port: 50051,
    streamSettings: JSON.stringify({
      network: "grpc",
      security: "none",
      grpcSettings: { serviceName: "svc", authority: "auth", multiMode: true },
    }),
  });
  expect(link.includes("serviceName=svc")).toBe(true);
  expect(link.includes("authority=auth")).toBe(true);
  expect(link.includes("mode=multi")).toBe(true);
});

test("query params are sorted alphabetically", () => {
  const link = vless({
    protocol: "vless",
    port: 1,
    streamSettings: JSON.stringify({ network: "ws", security: "none", wsSettings: { path: "/x", host: "y" } }),
  });
  const q = link.split("?")[1]!;
  const keys = q.split("&").map(kv => kv.split("=")[0]!);
  const sorted = [...keys].sort();
  expect(keys).toEqual(sorted);
});
