// src/db/devices.ts
import { db, type Bindings } from "./client";

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
  first_seen_at: string;
  last_seen_at: string;
};

export type DeviceWithUser = DeviceRow & {
  user: { id: number; username: string };
};

type RawDevice = Omit<DeviceRow, "is_blocked"> & { is_blocked: number };

function shape(r: RawDevice): DeviceRow {
  return { ...r, is_blocked: r.is_blocked === 1 };
}

function shapeWithUser({
  __username,
  ...rest
}: RawDevice & { __username: string }): DeviceWithUser {
  const base = shape(rest);
  return { ...base, user: { id: base.user_id, username: __username } };
}

export function upsertByHwid(attrs: {
  user_id: number;
  hwid: string;
  ua: string | null;
  ip: string | null;
}): DeviceRow {
  return shape(
    db()
      .query<RawDevice, Bindings>(
        `
    INSERT INTO devices (user_id, hwid, last_ua, last_ip)
    VALUES ($user_id, $hwid, $ua, $ip)
    ON CONFLICT (user_id, hwid) WHERE hwid IS NOT NULL
    DO UPDATE SET
      last_ua      = excluded.last_ua,
      last_ip      = excluded.last_ip,
      last_seen_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    RETURNING *`,
      )
      .get({
        user_id: attrs.user_id,
        hwid: attrs.hwid,
        ua: attrs.ua,
        ip: attrs.ip,
      })!,
  );
}

export function upsertByFallback(attrs: {
  user_id: number;
  ua: string;
  ip: string;
}): DeviceRow {
  return shape(
    db()
      .query<RawDevice, Bindings>(
        `
    INSERT INTO devices (user_id, fallback_ua, fallback_ip, last_ua, last_ip)
    VALUES ($user_id, $ua, $ip, $ua, $ip)
    ON CONFLICT (user_id, fallback_ua, fallback_ip) WHERE hwid IS NULL
    DO UPDATE SET last_seen_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    RETURNING *`,
      )
      .get({ user_id: attrs.user_id, ua: attrs.ua, ip: attrs.ip })!,
  );
}

export function findByFallback(attrs: {
  user_id: number;
  ua: string;
  ip: string;
}): DeviceRow | null {
  const row = db()
    .query<RawDevice, Bindings>(
      `
    SELECT * FROM devices
    WHERE user_id = $user_id AND hwid IS NULL
      AND fallback_ua = $ua AND fallback_ip = $ip`,
    )
    .get({ user_id: attrs.user_id, ua: attrs.ua, ip: attrs.ip });
  return row ? shape(row) : null;
}

export function get(id: number): DeviceRow | null {
  const row = db()
    .query<RawDevice, { id: number }>("SELECT * FROM devices WHERE id = $id")
    .get({ id });
  return row ? shape(row) : null;
}

export function remove(id: number): void {
  db()
    .query<never, { id: number }>("DELETE FROM devices WHERE id = $id")
    .run({ id });
}

export function listForUser(user_id: number): DeviceRow[] {
  return db()
    .query<RawDevice, { user_id: number }>(
      `
    SELECT * FROM devices WHERE user_id = $user_id ORDER BY last_seen_at DESC`,
    )
    .all({ user_id })
    .map(shape);
}

export function listBlocked(opts: {
  beforeId?: number;
  limit: number;
}): DeviceWithUser[] {
  const limit = Math.max(1, Math.min(1000, opts.limit));
  const beforeId = opts.beforeId ?? null;
  return db()
    .query<
      RawDevice & { __username: string },
      { beforeId: number | null; limit: number }
    >(
      `
    SELECT d.*, u.username AS __username
    FROM devices d JOIN users u ON u.id = d.user_id
    WHERE d.is_blocked = 1
      AND ($beforeId IS NULL OR d.id < $beforeId)
    ORDER BY d.id DESC LIMIT $limit`,
    )
    .all({ beforeId, limit })
    .map(shapeWithUser);
}

export function setBlocked(id: number, blocked: boolean): DeviceRow | null {
  const row = db()
    .query<RawDevice, { id: number; blocked: boolean }>(
      `
    UPDATE devices SET is_blocked = $blocked WHERE id = $id RETURNING *`,
    )
    .get({ id, blocked });
  return row ? shape(row) : null;
}

export function setLabel(id: number, label: string | null): DeviceRow | null {
  const row = db()
    .query<RawDevice, { id: number; label: string | null }>(
      `
    UPDATE devices SET label = $label WHERE id = $id RETURNING *`,
    )
    .get({ id, label });
  return row ? shape(row) : null;
}
