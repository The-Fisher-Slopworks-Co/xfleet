export type Cipher = {
  encrypt: (plaintext: string) => Promise<string>;
  decrypt: (envelope: string) => Promise<string>;
};

const HKDF_SALT = new TextEncoder().encode("xfleet-field-v1");
const HKDF_INFO = new TextEncoder().encode("aes-gcm-key");

export async function makeCipher(masterKeyB64: string): Promise<Cipher> {
  let raw: Uint8Array<ArrayBuffer>;
  try {
    raw = toArrayBufferView(Buffer.from(masterKeyB64, "base64"));
  } catch {
    throw new Error("MASTER_KEY must be base64");
  }
  if (raw.length !== 32) {
    throw new Error(`MASTER_KEY must decode to 32 bytes, got ${raw.length}`);
  }

  const hkdfKey = await crypto.subtle.importKey("raw", raw, "HKDF", false, ["deriveKey"]);
  const aesKey = await crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: HKDF_SALT, info: HKDF_INFO },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );

  const enc = new TextEncoder();
  const dec = new TextDecoder();

  return {
    async encrypt(plaintext: string) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ctWithTag = new Uint8Array(
        await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, enc.encode(plaintext)),
      );
      const tag = ctWithTag.slice(ctWithTag.length - 16);
      const ct = ctWithTag.slice(0, ctWithTag.length - 16);
      return `v1:${b64url(iv)}:${b64url(tag)}:${b64url(ct)}`;
    },
    async decrypt(envelope: string) {
      const parts = envelope.split(":");
      if (parts.length !== 4 || parts[0] !== "v1") throw new Error("bad envelope");
      const iv = fromB64url(parts[1]!);
      const tag = fromB64url(parts[2]!);
      const ct = fromB64url(parts[3]!);
      const full = new Uint8Array(ct.length + tag.length);
      full.set(ct, 0);
      full.set(tag, ct.length);
      const plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, aesKey, full));
      return dec.decode(plain);
    },
  };
}

function b64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  return toArrayBufferView(Buffer.from(s, "base64url"));
}

function toArrayBufferView(src: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(new ArrayBuffer(src.byteLength));
  copy.set(src);
  return copy;
}
