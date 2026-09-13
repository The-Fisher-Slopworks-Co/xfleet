// src/db/extSubLinks.ts
import { db } from "./client";

export type ExtSubLinkRow = {
  id: number;
  source_id: number;
  uri: string;
  label: string | null;
  sort_order: number;
  inserted_at: string;
};

export type ExtSubLinkWithSource = {
  uri: string;
  label: string | null;
  source_name: string;
};

export function listForSource(sourceId: number): ExtSubLinkRow[] {
  return db().query<ExtSubLinkRow, { sourceId: number }>(`
    SELECT * FROM ext_sub_links
    WHERE source_id = $sourceId
    ORDER BY sort_order ASC, id ASC`).all({ sourceId });
}

export function listForUser(userId: number): ExtSubLinkWithSource[] {
  return db().query<ExtSubLinkWithSource, { userId: number }>(`
    SELECT l.uri, l.label, s.name AS source_name
    FROM ext_sub_links l
    JOIN ext_sub_user_sources a ON a.source_id = l.source_id
    JOIN ext_sub_sources s       ON s.id = l.source_id
    WHERE a.user_id = $userId
    ORDER BY l.source_id ASC, l.sort_order ASC, l.id ASC`).all({ userId });
}

/**
 * Full-replace strategy: deletes every existing link for source_id and re-inserts
 * the given set in order, atomically.
 */
export function replaceForSource(
  sourceId: number,
  links: Array<{ uri: string; label: string | null }>,
): { inserted: number; deleted: number } {
  const conn = db();
  return conn.transaction(() => {
    const deleted = conn.query<never, { sourceId: number }>("DELETE FROM ext_sub_links WHERE source_id = $sourceId")
      .run({ sourceId }).changes;
    const insert = conn.query<never, { sourceId: number; uri: string; label: string | null; sortOrder: number }>(`
      INSERT INTO ext_sub_links (source_id, uri, label, sort_order)
      VALUES ($sourceId, $uri, $label, $sortOrder)`);
    links.forEach((l, i) => insert.run({ sourceId, uri: l.uri, label: l.label ?? null, sortOrder: i }));
    return { inserted: links.length, deleted };
  })();
}
