// src/server/env.test.ts
import { test, expect } from "bun:test";
import { loadEnv } from "./env";

const good = {
  PORT: "3000",
  DATABASE_URL: "postgres://u:p@h:5432/d",
  ADMIN_USERNAME: "admin",
  ADMIN_PASSWORD_HASH: "$2b$10$abcdefghijklmnopqrstuu",
  SESSION_SECRET: "a".repeat(64),
  MASTER_KEY: Buffer.alloc(32).toString("base64"),
  PROFILE_TITLE: "VPN",
  PUBLIC_BASE_URL: "http://localhost:3000",
};

test("accepts a fully-populated env", () => {
  const e = loadEnv(good);
  expect(e.port).toBe(3000);
  expect(e.adminUsername).toBe("admin");
  expect(e.profileTitle).toBe("VPN");
  expect(e.trustProxy).toBe(false);
});

test("TRUST_PROXY=true parses to trustProxy: true", () => {
  expect(loadEnv({ ...good, TRUST_PROXY: "true" }).trustProxy).toBe(true);
});

test("TRUST_PROXY rejects non-boolean strings", () => {
  expect(() => loadEnv({ ...good, TRUST_PROXY: "yes" })).toThrow(/TRUST_PROXY/);
});

test("SUB_JOURNAL_RETENTION_DAYS defaults to 90", () => {
  expect(loadEnv(good).subJournalRetentionDays).toBe(90);
});

test("SUB_JOURNAL_RETENTION_DAYS accepts positive integer", () => {
  expect(loadEnv({ ...good, SUB_JOURNAL_RETENTION_DAYS: "30" }).subJournalRetentionDays).toBe(30);
});

test("SUB_JOURNAL_RETENTION_DAYS rejects 0 (disallows infinite retention)", () => {
  expect(() => loadEnv({ ...good, SUB_JOURNAL_RETENTION_DAYS: "0" })).toThrow(/SUB_JOURNAL_RETENTION_DAYS/);
});

test("rejects missing required var", () => {
  const bad = { ...good, SESSION_SECRET: undefined as any };
  expect(() => loadEnv(bad)).toThrow(/SESSION_SECRET/);
});

test("rejects short SESSION_SECRET", () => {
  expect(() => loadEnv({ ...good, SESSION_SECRET: "short" })).toThrow(/SESSION_SECRET/);
});

test("rejects malformed PORT", () => {
  expect(() => loadEnv({ ...good, PORT: "nope" })).toThrow(/PORT/);
});

test("rejects malformed MASTER_KEY", () => {
  expect(() => loadEnv({ ...good, MASTER_KEY: "not base64!!" })).toThrow(/MASTER_KEY/);
});
