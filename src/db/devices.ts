// src/db/devices.ts
import { sql, toNum } from "./client";
import type { SQL } from "bun";

export type DeviceRow = {
  id: number;
  user_id: number;
  hwid: string | null;
  fallback_ua: string | null;
  fallback_ip: string | null;
  label: string | null;
  last_ua: string | null;
  last_ip: string | null;
  is_blocked: boolean;
  first_seen_at: Date;
  last_seen_at: Date;
};

export type DeviceWithUser = DeviceRow & {
  user: { id: number; username: string };
};

type Db = SQL;

function shape(r: any): DeviceRow {
  return {
    ...r,
    id: toNum(r.id),
    user_id: toNum(r.user_id),
    is_blocked: r.is_blocked === true || r.is_blocked === "t" || r.is_blocked === "true",
  };
}

function shapeWithUser(r: any): DeviceWithUser {
  const { __username, ...rest } = r;
  const base = shape(rest);
  return { ...base, user: { id: base.user_id, username: __username as string } };
}

export async function upsertByHwid(
  attrs: { user_id: number; hwid: string; ua: string | null; ip: string | null },
  db: Db = sql(),
): Promise<DeviceRow> {
  const rows = await db`
    INSERT INTO devices (user_id, hwid, last_ua, last_ip)
    VALUES (${attrs.user_id}, ${attrs.hwid}, ${attrs.ua}, ${attrs.ip})
    ON CONFLICT (user_id, hwid) WHERE hwid IS NOT NULL
    DO UPDATE SET
      last_ua      = EXCLUDED.last_ua,
      last_ip      = EXCLUDED.last_ip,
      last_seen_at = now()
    RETURNING *`;
  return shape(rows[0]!);
}

export async function upsertByFallback(
  attrs: { user_id: number; ua: string; ip: string },
  db: Db = sql(),
): Promise<DeviceRow> {
  const rows = await db`
    INSERT INTO devices (user_id, fallback_ua, fallback_ip, last_ua, last_ip)
    VALUES (${attrs.user_id}, ${attrs.ua}, ${attrs.ip}, ${attrs.ua}, ${attrs.ip})
    ON CONFLICT (user_id, fallback_ua, fallback_ip) WHERE hwid IS NULL
    DO UPDATE SET last_seen_at = now()
    RETURNING *`;
  return shape(rows[0]!);
}

export async function findByFallback(
  attrs: { user_id: number; ua: string; ip: string },
  db: Db = sql(),
): Promise<DeviceRow | null> {
  const rows = await db`
    SELECT * FROM devices
    WHERE user_id = ${attrs.user_id} AND hwid IS NULL
      AND fallback_ua = ${attrs.ua} AND fallback_ip = ${attrs.ip}`;
  return rows[0] ? shape(rows[0]) : null;
}

export async function get(id: number, db: Db = sql()): Promise<DeviceRow | null> {
  const rows = await db`SELECT * FROM devices WHERE id = ${id}`;
  return rows[0] ? shape(rows[0]) : null;
}

export async function remove(id: number, db: Db = sql()): Promise<void> {
  await db`DELETE FROM devices WHERE id = ${id}`;
}

export async function listForUser(user_id: number, db: Db = sql()): Promise<DeviceRow[]> {
  const rows = await db`
    SELECT * FROM devices WHERE user_id = ${user_id} ORDER BY last_seen_at DESC`;
  return rows.map(shape);
}

export async function listBlocked(
  opts: { beforeId?: number; limit: number },
  db: Db = sql(),
): Promise<DeviceWithUser[]> {
  const limit = Math.max(1, Math.min(1000, opts.limit));
  const beforeId = opts.beforeId ?? null;
  const rows = await db`
    SELECT d.*, u.username AS __username
    FROM devices d JOIN users u ON u.id = d.user_id
    WHERE d.is_blocked = true
      AND (${beforeId}::bigint IS NULL OR d.id < ${beforeId})
    ORDER BY d.id DESC LIMIT ${limit}`;
  return rows.map(shapeWithUser);
}

export async function setBlocked(id: number, blocked: boolean, db: Db = sql()): Promise<DeviceRow | null> {
  const rows = await db`
    UPDATE devices SET is_blocked = ${blocked} WHERE id = ${id} RETURNING *`;
  return rows[0] ? shape(rows[0]) : null;
}

export async function setLabel(id: number, label: string | null, db: Db = sql()): Promise<DeviceRow | null> {
  const rows = await db`
    UPDATE devices SET label = ${label} WHERE id = ${id} RETURNING *`;
  return rows[0] ? shape(rows[0]) : null;
}
