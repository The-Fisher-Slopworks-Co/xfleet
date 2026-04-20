const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export function generateToken(length = 32): string {
  if (!Number.isInteger(length) || length <= 0) {
    throw new Error(`generateToken: length must be a positive integer, got ${length}`);
  }
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CHARS[bytes[i]! % CHARS.length];
  }
  return out;
}
