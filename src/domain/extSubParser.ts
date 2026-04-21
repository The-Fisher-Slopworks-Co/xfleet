// src/domain/extSubParser.ts
export type ParsedLink = { uri: string; label: string | null };

/**
 * Parses an external subscription body (as returned by a typical VPN provider's
 * subscription endpoint). Accepts either a single base64 blob or already-decoded
 * newline-delimited URIs. Strips the `#fragment` from each URI, keeping the
 * fragment text as a separate `label` (null when absent).
 *
 * Pure function — no I/O. Safe to unit test exhaustively.
 */
export function parseSubBody(raw: string): ParsedLink[] {
  const decoded = tryBase64Decode(raw.trim()) ?? raw;
  const lines = decoded.split(/\r?\n/);
  const out: ParsedLink[] = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (!line.includes("://")) continue;
    out.push(stripFragment(line));
  }
  return out;
}

function tryBase64Decode(s: string): string | null {
  if (!s) return null;
  // A plaintext subscription always contains "://"; a base64 blob doesn't.
  if (s.includes("://")) return null;
  // Quick reject: base64 uses [A-Za-z0-9+/=] plus whitespace.
  if (!/^[A-Za-z0-9+/=\r\n\s_-]+$/.test(s)) return null;
  try {
    const decoded = Buffer.from(s, "base64").toString("utf8");
    return decoded.includes("://") ? decoded : null;
  } catch {
    return null;
  }
}

function stripFragment(line: string): ParsedLink {
  const hashIdx = line.indexOf("#");
  if (hashIdx === -1) return { uri: line, label: null };
  const uri = line.slice(0, hashIdx);
  const rawLabel = line.slice(hashIdx + 1);
  let label: string | null;
  try {
    label = decodeURIComponent(rawLabel);
  } catch {
    label = rawLabel;
  }
  label = label.trim();
  return { uri, label: label ? label : null };
}
