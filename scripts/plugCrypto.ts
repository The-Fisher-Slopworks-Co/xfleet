import { pbkdf2Sync } from "node:crypto";
import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";

// Plug.Crypto.KeyGenerator defaults: 1000 iterations, SHA-256, 32 bytes.
// Key salt used by EUi.EncryptedField: "encrypted field".
const DEFAULT_ITERATIONS = 1000;
const DEFAULT_LENGTH = 32;
const AAD = new TextEncoder().encode("A128GCM");

export function plugCryptoDecrypt(envelope: string, secretKeyBase: string): string {
  if (!envelope.startsWith("XCP.")) {
    throw new Error(`unsupported envelope format (expected XCP. prefix, got ${envelope.slice(0, 10)})`);
  }
  const payload = Buffer.from(envelope.slice(4), "base64url");
  if (payload.length < 24 + 16) {
    throw new Error(`plug_crypto envelope too short: ${payload.length} bytes`);
  }
  const iv = payload.subarray(0, 24);
  const tag = payload.subarray(24, 40);
  const ct = payload.subarray(40);

  const key = pbkdf2Sync(secretKeyBase, "encrypted field", DEFAULT_ITERATIONS, DEFAULT_LENGTH, "sha256");

  // xchacha20poly1305 from @noble/ciphers expects ciphertext with tag appended.
  const ctWithTag = new Uint8Array(ct.length + tag.length);
  ctWithTag.set(ct, 0);
  ctWithTag.set(tag, ct.length);

  const cipher = xchacha20poly1305(new Uint8Array(key), new Uint8Array(iv), AAD);
  const plain = cipher.decrypt(ctWithTag);
  return new TextDecoder().decode(plain);
}
