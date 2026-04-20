// src/shared/schemas.test.ts
import { test, expect } from "bun:test";
import { userCreateSchema, serverCreateSchema, configCreateSchema, threeXUiCreateSchema, threeXUiUpdateSchema } from "./schemas";

test("userCreateSchema accepts alnum+_ username", () => {
  expect(userCreateSchema.safeParse({ username: "a_b_9", token: "t".repeat(16) }).success).toBe(true);
});
test("userCreateSchema rejects bad username", () => {
  expect(userCreateSchema.safeParse({ username: "a b", token: "t".repeat(16) }).success).toBe(false);
  expect(userCreateSchema.safeParse({ username: "", token: "t".repeat(16) }).success).toBe(false);
});

test("serverCreateSchema requires name", () => {
  expect(serverCreateSchema.safeParse({ name: "ok" }).success).toBe(true);
  expect(serverCreateSchema.safeParse({ name: "" }).success).toBe(false);
});

test("configCreateSchema tag regex", () => {
  expect(configCreateSchema.safeParse({ user_id: 1, server_id: 1, config: "vless://x", tag: "ok tag.1_-2" }).success).toBe(true);
  expect(configCreateSchema.safeParse({ user_id: 1, server_id: 1, config: "vless://x", tag: "bad#tag" }).success).toBe(false);
});

test("threeXUiCreateSchema validates port and requires password", () => {
  const base = { name: "n", url: "https://h:443", username: "u", password: "p", server_id: 1 };
  expect(threeXUiCreateSchema.safeParse(base).success).toBe(true);
  expect(threeXUiCreateSchema.safeParse({ ...base, password: "" }).success).toBe(false);
});

test("threeXUiUpdateSchema allows missing password", () => {
  expect(threeXUiUpdateSchema.safeParse({ name: "n", url: "https://h:443", username: "u", server_id: 1 }).success).toBe(true);
});
