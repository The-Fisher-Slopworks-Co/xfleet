import { test, expect } from "bun:test";
import { generateToken } from "./passwordGenerator";

test("generateToken default length is 32", () => {
  expect(generateToken().length).toBe(32);
});

test("generateToken respects given length", () => {
  expect(generateToken(16).length).toBe(16);
  expect(generateToken(64).length).toBe(64);
});

test("generateToken only uses [A-Za-z0-9]", () => {
  const t = generateToken(256);
  expect(/^[A-Za-z0-9]+$/.test(t)).toBe(true);
});

test("generateToken returns different values each call", () => {
  const a = generateToken();
  const b = generateToken();
  expect(a).not.toBe(b);
});

test("generateToken throws on non-positive length", () => {
  expect(() => generateToken(0)).toThrow();
  expect(() => generateToken(-1)).toThrow();
});
