// src/db/subFetchJournal.ts
import { db, type Bindings } from "./client";

export type BlockedBy = "device" | "ip";

export type SubFetchJournalRow = {
  id: number;
  user_id: number | null;
  attempted_token: string;
  ip: string | null;
  user_agent: string | null;
  headers: Record<string, string>;
  status_code: number;
  device_id: number | null;
  blocked_by: BlockedBy | null;
  inserted_at: string;
};

export type SubFetchJournalWithUser = SubFetchJournalRow & {
  user: { id: number; username: string } | null;
};

export type RecordAttrs = {
  user_id: number | null;
  attempted_token: string;
  ip: string | null;
  user_agent: string | null;
  headers: Record<string, string>;
  status_code: number;
  device_id: number | null;
  blocked_by: BlockedBy | null;
};

type RawRow = Omit<SubFetchJournalRow, "headers"> & { headers: string };

function shape(r: RawRow): SubFetchJournalRow {
  return { ...r, headers: JSON.parse(r.headers) as Record<string, string> };
}

function shapeWithUser({ __username, ...rest }: RawRow & { __username: string | null }): SubFetchJournalWithUser {
  const base = shape(rest);
  const user = base.user_id !== null && __username !== null
    ? { id: base.user_id, username: __username }
    : null;
  return { ...base, user };
}

export function record(attrs: RecordAttrs): SubFetchJournalRow {
  return shape(db().query<RawRow, Bindings>(`
    INSERT INTO sub_fetch_journal (user_id, attempted_token, ip, user_agent, headers, status_code, device_id, blocked_by)
    VALUES (
      $user_id, $attempted_token, $ip,
      $user_agent, $headers, $status_code,
      $device_id, $blocked_by
    )
    RETURNING *`).get({
    user_id: attrs.user_id,
    attempted_token: attrs.attempted_token,
    ip: attrs.ip,
    user_agent: attrs.user_agent,
    headers: JSON.stringify(attrs.headers),
    status_code: attrs.status_code,
    device_id: attrs.device_id,
    blocked_by: attrs.blocked_by,
  })!);
}

export function pruneOlderThan(days: number): number {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60_000).toISOString();
  return db().query<never, { cutoff: string }>("DELETE FROM sub_fetch_journal WHERE inserted_at < $cutoff")
    .run({ cutoff }).changes;
}

export function list(opts: { userId?: number; beforeId?: number; limit: number }): SubFetchJournalWithUser[] {
  const params: Bindings = { limit: Math.max(1, Math.min(1000, opts.limit)) };
  // Only filters that are set go into the SQL, so SQLite can seek the
  // (user_id, id DESC) index instead of scanning past `$x IS NULL OR ...` terms.
  const conds: string[] = [];
  if (opts.userId !== undefined) { conds.push("j.user_id = $userId"); params.userId = opts.userId; }
  if (opts.beforeId !== undefined) { conds.push("j.id < $beforeId"); params.beforeId = opts.beforeId; }
  const where = conds.length > 0 ? `WHERE ${conds.join(" AND ")}` : "";
  return db().query<RawRow & { __username: string | null }, Bindings>(`
    SELECT j.*, u.username AS __username
    FROM sub_fetch_journal j LEFT JOIN users u ON u.id = j.user_id
    ${where}
    ORDER BY j.id DESC LIMIT $limit`).all(params).map(shapeWithUser);
}
