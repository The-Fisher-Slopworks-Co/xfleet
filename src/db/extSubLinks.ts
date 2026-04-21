// src/db/extSubLinks.ts
import { sql, toNum } from "./client";
import type { SQL } from "bun";

export type ExtSubLinkRow = {
  id: number;
  source_id: number;
  uri: string;
  label: string | null;
  sort_order: number;
  inserted_at: Date;
};

export type ExtSubLinkWithSource = {
  uri: string;
  label: string | null;
  source_name: string;
};

type Db = SQL;

function shape(r: any): ExtSubLinkRow {
  return { ...r, id: toNum(r.id), source_id: toNum(r.source_id), sort_order: toNum(r.sort_order) };
}

export async function listForSource(sourceId: number, db: Db = sql()): Promise<ExtSubLinkRow[]> {
  const rows = await db`
    SELECT * FROM ext_sub_links
    WHERE source_id = ${sourceId}
    ORDER BY sort_order ASC, id ASC`;
  return rows.map(shape);
}

export async function listForUser(userId: number, db: Db = sql()): Promise<ExtSubLinkWithSource[]> {
  const rows = await db`
    SELECT l.uri, l.label, s.name AS source_name
    FROM ext_sub_links l
    JOIN ext_sub_user_sources a ON a.source_id = l.source_id
    JOIN ext_sub_sources s       ON s.id = l.source_id
    WHERE a.user_id = ${userId}
    ORDER BY l.source_id ASC, l.sort_order ASC, l.id ASC`;
  return rows.map((r: any) => ({
    uri: r.uri,
    label: r.label ?? null,
    source_name: r.source_name,
  }));
}

/**
 * Full-replace strategy: deletes every existing link for source_id and re-inserts
 * the given set in order. Caller must run this inside a transaction that holds an
 * advisory lock on the source (see domain/extSubSync.ts).
 */
export async function replaceForSource(
  sourceId: number,
  links: Array<{ uri: string; label: string | null }>,
  db: Db = sql(),
): Promise<{ inserted: number; deleted: number }> {
  const delResult = await db`DELETE FROM ext_sub_links WHERE source_id = ${sourceId}`;
  const deleted = toNum(delResult.count ?? 0);
  let inserted = 0;
  for (let i = 0; i < links.length; i++) {
    const l = links[i]!;
    await db`
      INSERT INTO ext_sub_links (source_id, uri, label, sort_order)
      VALUES (${sourceId}, ${l.uri}, ${l.label ?? null}, ${i})`;
    inserted++;
  }
  return { inserted, deleted };
}
