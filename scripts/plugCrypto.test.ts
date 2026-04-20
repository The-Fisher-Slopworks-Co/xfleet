import { test, expect } from "bun:test";
import { readFile } from "node:fs/promises";
import { plugCryptoDecrypt } from "./plugCrypto";

test("decrypts Elixir-produced ciphertext", async () => {
  const fx = JSON.parse(await readFile("scripts/fixtures/plug-encrypted.json", "utf8"));
  const plain = plugCryptoDecrypt(fx.ciphertext, fx.secret_key_base);
  expect(plain).toBe(fx.plaintext);
});

test("rejects wrong prefix", () => {
  expect(() => plugCryptoDecrypt("QTEyOEdDTQ.abc", "secret")).toThrow(/unsupported envelope/);
});

test("rejects envelope that is too short", () => {
  expect(() => plugCryptoDecrypt("XCP.YQ", "secret")).toThrow(/too short/);
});
