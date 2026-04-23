// src/db/subFetchJournal.ts
import { sql, toNum, toNumOrNull } from "./client";
import type { SQL } from "bun";

export type SubFetchJournalRow = {
  id: number;
  user_id: number | null;
  attempted_token: string;
  ip: string | null;
  user_agent: string | null;
  headers: Record<string, string>;
  status_code: number;
  inserted_at: Date;
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
};

type Db = SQL;

function parseHeaders(v: unknown): Record<string, string> {
  if (v && typeof v === "object") return v as Record<string, string>;
  if (typeof v === "string") {
    try { return JSON.parse(v) as Record<string, string>; } catch { return {}; }
  }
  return {};
}

function shape(r: any): SubFetchJournalRow {
  return {
    ...r,
    id: toNum(r.id),
    user_id: toNumOrNull(r.user_id),
    status_code: toNum(r.status_code),
    headers: parseHeaders(r.headers),
  };
}

function shapeWithUser(r: any): SubFetchJournalWithUser {
  const { __username, ...rest } = r;
  const base = shape(rest);
  const user = base.user_id !== null && __username !== null
    ? { id: base.user_id, username: __username as string }
    : null;
  return { ...base, user };
}

export async function record(attrs: RecordAttrs, db: Db = sql()): Promise<SubFetchJournalRow> {
  const rows = await db`
    INSERT INTO sub_fetch_journal (user_id, attempted_token, ip, user_agent, headers, status_code)
    VALUES (
      ${attrs.user_id}, ${attrs.attempted_token}, ${attrs.ip},
      ${attrs.user_agent}, ${JSON.stringify(attrs.headers)}::jsonb, ${attrs.status_code}
    )
    RETURNING *`;
  return shape(rows[0]!);
}

export async function pruneOlderThan(days: number, db: Db = sql()): Promise<number> {
  const result = await db`
    DELETE FROM sub_fetch_journal
    WHERE inserted_at < now() - make_interval(days => ${days})`;
  return toNum(result.count ?? 0);
}

export async function list(
  opts: { userId?: number; beforeId?: number; limit: number },
  db: Db = sql(),
): Promise<SubFetchJournalWithUser[]> {
  const limit = Math.max(1, Math.min(1000, opts.limit));
  const userId = opts.userId ?? null;
  const beforeId = opts.beforeId ?? null;
  const rows = await db`
    SELECT j.*, u.username AS __username
    FROM sub_fetch_journal j LEFT JOIN users u ON u.id = j.user_id
    WHERE (${userId}::bigint IS NULL OR j.user_id = ${userId})
      AND (${beforeId}::bigint IS NULL OR j.id < ${beforeId})
    ORDER BY j.id DESC LIMIT ${limit}`;
  return rows.map(shapeWithUser);
}
