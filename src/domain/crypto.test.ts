import { test, expect, beforeAll } from "bun:test";
import { makeCipher } from "./crypto";

const KEY = Buffer.from(new Uint8Array(32).fill(7)).toString("base64");
let cipher: ReturnType<typeof makeCipher> extends Promise<infer T> ? T : never;

beforeAll(async () => {
  cipher = await makeCipher(KEY);
});

test("encrypt/decrypt round-trips arbitrary strings", async () => {
  const cases = ["", "hello", "🔐 unicode", "a".repeat(5000)];
  for (const plaintext of cases) {
    const envelope = await cipher.encrypt(plaintext);
    const decrypted = await cipher.decrypt(envelope);
    expect(decrypted).toBe(plaintext);
  }
});

test("envelope starts with v1: prefix", async () => {
  const envelope = await cipher.encrypt("x");
  expect(envelope.startsWith("v1:")).toBe(true);
});

test("each encrypt produces a distinct envelope", async () => {
  const a = await cipher.encrypt("same");
  const b = await cipher.encrypt("same");
  expect(a).not.toBe(b);
});

test("decrypt rejects tampered ciphertext", async () => {
  const envelope = await cipher.encrypt("secret");
  const parts = envelope.split(":");
  // flip a bit in the ciphertext chunk
  const ct = Buffer.from(parts[3]!, "base64url");
  ct[0] ^= 0x01;
  const bad = `${parts[0]}:${parts[1]}:${parts[2]}:${ct.toString("base64url")}`;
  await expect(cipher.decrypt(bad)).rejects.toThrow();
});

test("decrypt rejects wrong version prefix", async () => {
  const envelope = await cipher.encrypt("x");
  const bad = "v2:" + envelope.slice(3);
  await expect(cipher.decrypt(bad)).rejects.toThrow();
});

test("makeCipher rejects malformed MASTER_KEY", async () => {
  await expect(makeCipher("not-base64!!")).rejects.toThrow();
  await expect(makeCipher(Buffer.alloc(16).toString("base64"))).rejects.toThrow();
});
