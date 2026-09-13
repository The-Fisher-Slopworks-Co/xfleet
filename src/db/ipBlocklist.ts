// src/db/ipBlocklist.ts
import { db } from "./client";
import { cidrContains, formatCidr, parseCidr, parseIp } from "../shared/ip";

export type IpBlocklistRow = {
  id: number;
  cidr: string;
  note: string | null;
  inserted_at: string;
};

export function list(): IpBlocklistRow[] {
  return db().query<IpBlocklistRow, []>("SELECT * FROM ip_blocklist ORDER BY id DESC").all();
}

/** Stores the canonical form so equivalent spellings hit the UNIQUE constraint. */
export function add(attrs: { cidr: string; note: string | null }): IpBlocklistRow {
  const parsed = parseCidr(attrs.cidr);
  if (!parsed) throw new Error(`invalid IP or CIDR: ${attrs.cidr}`);
  return db().query<IpBlocklistRow, { cidr: string; note: string | null }>(`
    INSERT INTO ip_blocklist (cidr, note) VALUES ($cidr, $note)
    RETURNING *`).get({ cidr: formatCidr(parsed), note: attrs.note })!;
}

export function remove(id: number): void {
  db().query<never, { id: number }>("DELETE FROM ip_blocklist WHERE id = $id").run({ id });
}

/** True when the IP matches any entry — exact or CIDR range. An unparseable IP matches nothing. */
export function isBlocked(ip: string): boolean {
  const addr = parseIp(ip);
  if (!addr) return false;
  return db().query<{ cidr: string }, []>("SELECT cidr FROM ip_blocklist").all().some(r => {
    const net = parseCidr(r.cidr);
    return net !== null && cidrContains(net, addr);
  });
}
