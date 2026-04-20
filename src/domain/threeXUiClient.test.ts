// src/domain/threeXUiClient.test.ts
import { test, expect, beforeEach, afterEach, mock } from "bun:test";
import { login, listInbounds, baseUrl } from "./threeXUiClient";

const server = { name: "p", host: "h", port: 2053, web_base_path: "/", username: "u", password: "pw", use_tls: true };

let origFetch: typeof fetch;

beforeEach(() => { origFetch = globalThis.fetch; });
afterEach(() => { globalThis.fetch = origFetch; });

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  globalThis.fetch = mock(async (input: any, init?: any) => handler(typeof input === "string" ? input : input.url, init)) as any;
}

test("baseUrl omits trailing slash path", () => {
  expect(baseUrl(server)).toBe("https://h:2053");
  expect(baseUrl({ ...server, use_tls: false, web_base_path: "/panel" })).toBe("http://h:2053/panel");
});

test("login returns session cookie on success", async () => {
  mockFetch(() => new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: [["content-type", "application/json"], ["set-cookie", "sid=abc; Path=/; HttpOnly"]],
  }));
  const r = await login(server);
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.cookie).toBe("sid=abc");
});

test("login returns auth_failed on success=false", async () => {
  mockFetch(() => new Response(JSON.stringify({ success: false, msg: "nope" }), { status: 200, headers: { "content-type": "application/json" } }));
  const r = await login(server);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error.kind).toBe("auth_failed");
});

test("login returns no_cookie when missing", async () => {
  mockFetch(() => new Response(JSON.stringify({ success: true }), { status: 200, headers: { "content-type": "application/json" } }));
  const r = await login(server);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error.kind).toBe("no_cookie");
});

test("listInbounds returns array on success", async () => {
  mockFetch(() => new Response(JSON.stringify({ success: true, obj: [{ id: 1 }] }), { status: 200, headers: { "content-type": "application/json" } }));
  const r = await listInbounds(server, "sid=abc");
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.inbounds).toEqual([{ id: 1 }]);
});

test("listInbounds returns api_error on success=false", async () => {
  mockFetch(() => new Response(JSON.stringify({ success: false, msg: "bad" }), { status: 200, headers: { "content-type": "application/json" } }));
  const r = await listInbounds(server, "sid=abc");
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error).toEqual({ kind: "api_error", msg: "bad" });
});

test("login returns connection_failed when fetch throws", async () => {
  globalThis.fetch = (async () => { throw new Error("nope"); }) as any;
  const r = await login(server);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error.kind).toBe("connection_failed");
});
