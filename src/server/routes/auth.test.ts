// src/server/routes/auth.test.ts
import { test, expect } from "bun:test";
import bcrypt from "bcryptjs";
import { authRoutes } from "./auth";
import type { Env } from "../env";

const hash = bcrypt.hashSync("hunter2", 10);
const env: Env = {
  port: 0, databaseUrl: "", adminUsername: "admin", adminPasswordHash: hash,
  sessionSecret: "x".repeat(64), masterKey: "", profileTitle: "VPN", publicBaseUrl: "http://x",
};

test("login returns 401 on wrong password", async () => {
  const routes = authRoutes(env);
  const res = await routes["/api/auth/login"].POST(
    new Request("http://x/api/auth/login", { method: "POST", body: JSON.stringify({ username: "admin", password: "wrong" }) }),
  );
  expect(res.status).toBe(401);
});

test("login sets cookie on success", async () => {
  const routes = authRoutes(env);
  const res = await routes["/api/auth/login"].POST(
    new Request("http://x/api/auth/login", { method: "POST", body: JSON.stringify({ username: "admin", password: "hunter2" }) }),
  );
  expect(res.status).toBe(200);
  expect(res.headers.get("set-cookie")).toMatch(/^eui_session=[^;]+/);
});

test("me returns 401 without cookie", async () => {
  const routes = authRoutes(env);
  const res = await routes["/api/auth/me"].GET(new Request("http://x/api/auth/me"));
  expect(res.status).toBe(401);
});

test("me returns username with valid cookie", async () => {
  const routes = authRoutes(env);
  const login = await routes["/api/auth/login"].POST(
    new Request("http://x/api/auth/login", { method: "POST", body: JSON.stringify({ username: "admin", password: "hunter2" }) }),
  );
  const cookie = login.headers.get("set-cookie")!.split(";")[0]!;
  const res = await routes["/api/auth/me"].GET(new Request("http://x/api/auth/me", { headers: { cookie } }));
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ username: "admin" });
});
