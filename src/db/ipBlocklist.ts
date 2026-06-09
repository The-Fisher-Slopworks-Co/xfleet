// src/db/ipBlocklist.ts
import { sql, toNum } from "./client";
import type { SQL } from "bun";

export type IpBlocklistRow = {
  id: number;
  cidr: string;
  note: string | null;
  inserted_at: Date;
};

type Db = SQL;

function shape(r: any): IpBlocklistRow {
  return { ...r, id: toNum(r.id) };
}

export async function list(db: Db = sql()): Promise<IpBlocklistRow[]> {
  const rows = await db`SELECT * FROM ip_blocklist ORDER BY id DESC`;
  return rows.map(shape);
}

export async function add(
  attrs: { cidr: string; note: string | null },
  db: Db = sql(),
): Promise<IpBlocklistRow> {
  const rows = await db`
    INSERT INTO ip_blocklist (cidr, note) VALUES (${attrs.cidr}::inet, ${attrs.note})
    RETURNING *`;
  return shape(rows[0]!);
}

export async function remove(id: number, db: Db = sql()): Promise<void> {
  await db`DELETE FROM ip_blocklist WHERE id = ${id}`;
}

/** True when the IP matches any entry — exact or CIDR range (inet containment). */
export async function isBlocked(ip: string, db: Db = sql()): Promise<boolean> {
  const rows = await db`
    SELECT 1 FROM ip_blocklist WHERE ${ip}::inet <<= cidr LIMIT 1`;
  return rows.length > 0;
}
