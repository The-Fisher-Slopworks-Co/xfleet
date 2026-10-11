// src/shared/ip.ts
// IPv4/IPv6 address and CIDR parsing for the IP blocklist. Follows Postgres inet
// semantics: host bits past the prefix are kept as written, and an address only
// matches a network of its own family (::ffff:1.2.3.4 is not inside 1.2.3.0/24).

export type IpAddr = { v6: boolean; bytes: Uint8Array };
export type Cidr = IpAddr & { prefix: number };

export function parseIp(s: string): IpAddr | null {
  if (s.includes(":")) {
    const bytes = parseV6(s);
    return bytes && { v6: true, bytes };
  }
  const bytes = parseV4(s);
  return bytes && { v6: false, bytes };
}

/** Accepts an exact IP (implicit /32 or /128) or `ip/prefix`. */
export function parseCidr(s: string): Cidr | null {
  const slash = s.indexOf("/");
  const addr = parseIp(slash === -1 ? s : s.slice(0, slash));
  if (!addr) return null;
  const max = addr.v6 ? 128 : 32;
  if (slash === -1) return { ...addr, prefix: max };
  const raw = s.slice(slash + 1);
  if (!/^\d{1,3}$/.test(raw)) return null;
  const prefix = Number(raw);
  return prefix <= max ? { ...addr, prefix } : null;
}

/** Canonical text form (RFC 5952 for IPv6); the prefix is omitted for a single host. */
export function formatCidr(c: Cidr): string {
  const addr = c.v6 ? formatV6(c.bytes) : c.bytes.join(".");
  return c.prefix === (c.v6 ? 128 : 32) ? addr : `${addr}/${c.prefix}`;
}

export function cidrContains(net: Cidr, ip: IpAddr): boolean {
  if (net.v6 !== ip.v6) return false;
  const fullBytes = net.prefix >> 3;
  for (let i = 0; i < fullBytes; i++) {
    if (net.bytes[i] !== ip.bytes[i]) return false;
  }
  const restBits = net.prefix % 8;
  if (restBits === 0) return true;
  const mask = (0xff << (8 - restBits)) & 0xff;
  return ((net.bytes[fullBytes]! ^ ip.bytes[fullBytes]!) & mask) === 0;
}

function parseV4(s: string): Uint8Array | null {
  const parts = s.split(".");
  if (parts.length !== 4) return null;
  const out = new Uint8Array(4);
  for (let i = 0; i < 4; i++) {
    if (!/^\d{1,3}$/.test(parts[i]!)) return null;
    const n = Number(parts[i]);
    if (n > 255) return null;
    out[i] = n;
  }
  return out;
}

function parseV6(s: string): Uint8Array | null {
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const compressed = halves.length === 2;
  const head = words(halves[0]!, !compressed);
  const tail = compressed ? words(halves[1]!, true) : [];
  if (!head || !tail) return null;
  const missing = 8 - head.length - tail.length;
  if (compressed ? missing < 1 : missing !== 0) return null;
  const all = [
    ...head,
    ...Array.from({ length: compressed ? missing : 0 }, () => 0),
    ...tail,
  ];
  const out = new Uint8Array(16);
  all.forEach((w, i) => {
    out[2 * i] = w >> 8;
    out[2 * i + 1] = w & 0xff;
  });
  return out;
}

// Colon-separated hex groups as 16-bit words. A dotted IPv4 part, allowed only
// at the very end of the address, counts as two words.
function words(part: string, allowV4Tail: boolean): number[] | null {
  if (part === "") return [];
  const items = part.split(":");
  const out: number[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    if (allowV4Tail && i === items.length - 1 && item.includes(".")) {
      const v4 = parseV4(item);
      if (!v4) return null;
      out.push((v4[0]! << 8) | v4[1]!, (v4[2]! << 8) | v4[3]!);
    } else if (/^[0-9a-fA-F]{1,4}$/.test(item)) {
      out.push(parseInt(item, 16));
    } else {
      return null;
    }
  }
  return out;
}

function formatV6(b: Uint8Array): string {
  const w = Array.from(
    { length: 8 },
    (_, i) => (b[2 * i]! << 8) | b[2 * i + 1]!,
  );
  // IPv4-mapped addresses keep the dotted tail, as Postgres prints them.
  if (w.slice(0, 5).every((x) => x === 0) && w[5] === 0xffff) {
    return `::ffff:${b.slice(12).join(".")}`;
  }
  // The longest run of two or more zero words collapses to "::"; the first run wins ties.
  let bestStart = -1;
  let bestLen = 1;
  for (let i = 0; i < 8;) {
    if (w[i] !== 0) {
      i++;
      continue;
    }
    let j = i;
    while (j < 8 && w[j] === 0) j++;
    if (j - i > bestLen) {
      bestStart = i;
      bestLen = j - i;
    }
    i = j;
  }
  const hex = w.map((x) => x.toString(16));
  if (bestStart === -1) return hex.join(":");
  return `${hex.slice(0, bestStart).join(":")}::${hex.slice(bestStart + bestLen).join(":")}`;
}
