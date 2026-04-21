// src/server/session.test.ts
import { test, expect } from "bun:test";
import { issueSession, verifySession } from "./session";

const SECRET = "a".repeat(64);

test("issue/verify round-trip", () => {
  const { cookie, value } = issueSession("admin", SECRET);
  expect(cookie.startsWith("xfleet_session=")).toBe(true);
  const parsed = verifySession(value, SECRET);
  expect(parsed?.u).toBe("admin");
  expect(parsed?.iat).toBeGreaterThan(0);
});

test("verify rejects tampered payload", () => {
  const { value } = issueSession("admin", SECRET);
  const parts = value.split(".");
  const tampered = Buffer.from('{"u":"root","iat":1}').toString("base64url") + "." + parts[1];
  expect(verifySession(tampered, SECRET)).toBeNull();
});

test("verify rejects bad mac", () => {
  const { value } = issueSession("admin", SECRET);
  const parts = value.split(".");
  expect(verifySession(parts[0] + "." + "x".repeat(parts[1]!.length), SECRET)).toBeNull();
});

test("verify rejects expired cookie", () => {
  const { value } = issueSession("admin", SECRET, { iat: Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 8 });
  expect(verifySession(value, SECRET)).toBeNull();
});

test("readSessionCookie parses cookie header", async () => {
  const { readSessionCookie } = await import("./session");
  expect(readSessionCookie("a=1; xfleet_session=abc.def; b=2")).toBe("abc.def");
  expect(readSessionCookie("x=1")).toBeNull();
  expect(readSessionCookie(null)).toBeNull();
});
