// src/db/configs.ts
import { db, type Bindings } from "./client";

export type ConfigRow = {
  id: number;
  user_id: number;
  server_id: number;
  config: string;
  tag: string | null;
  three_x_ui_server_id: number | null;
  external_email: string | null;
  inserted_at: string;
  updated_at: string;
};

export type ConfigWithServer = ConfigRow & {
  server: { id: number; name: string };
};

type JoinedRow = ConfigRow & { __server_name: string };

function stripServerName(s: string): string {
  const idx = s.indexOf("#");
  return idx === -1 ? s : s.slice(0, idx);
}

export function listAll(): ConfigWithServer[] {
  return db()
    .query<JoinedRow, []>(
      `
    SELECT c.*, s.name AS __server_name
    FROM configs c JOIN servers s ON s.id = c.server_id
    ORDER BY c.user_id ASC, c.server_id ASC`,
    )
    .all()
    .map(shapeWithServer);
}
export function listForUser(userId: number): ConfigWithServer[] {
  return db()
    .query<JoinedRow, { userId: number }>(
      `
    SELECT c.*, s.name AS __server_name
    FROM configs c JOIN servers s ON s.id = c.server_id
    WHERE c.user_id = $userId
    ORDER BY c.id ASC`,
    )
    .all({ userId })
    .map(shapeWithServer);
}
export function get(id: number): ConfigWithServer | null {
  const row = db()
    .query<JoinedRow, { id: number }>(
      `
    SELECT c.*, s.name AS __server_name
    FROM configs c JOIN servers s ON s.id = c.server_id
    WHERE c.id = $id`,
    )
    .get({ id });
  return row ? shapeWithServer(row) : null;
}
export function create(attrs: {
  user_id: number;
  server_id: number;
  config: string;
  tag?: string | null | undefined;
  three_x_ui_server_id?: number | null | undefined;
  external_email?: string | null | undefined;
}): ConfigRow {
  return db()
    .query<ConfigRow, Bindings>(
      `
    INSERT INTO configs (user_id, server_id, config, tag, three_x_ui_server_id, external_email)
    VALUES ($user_id, $server_id, $config, $tag, $three_x_ui_server_id, $external_email)
    RETURNING *`,
    )
    .get({
      user_id: attrs.user_id,
      server_id: attrs.server_id,
      config: stripServerName(attrs.config),
      tag: attrs.tag ?? null,
      three_x_ui_server_id: attrs.three_x_ui_server_id ?? null,
      external_email: attrs.external_email ?? null,
    })!;
}
export function update(
  id: number,
  attrs: {
    user_id?: number | undefined;
    server_id?: number | undefined;
    config?: string | undefined;
    tag?: string | null | undefined;
    three_x_ui_server_id?: number | null | undefined;
    external_email?: string | null | undefined;
  },
): ConfigRow | null {
  return db()
    .query<ConfigRow, Bindings>(
      `
    UPDATE configs SET
      user_id = COALESCE($user_id, user_id),
      server_id = COALESCE($server_id, server_id),
      config = COALESCE($config, config),
      tag = CASE WHEN $set_tag THEN $tag ELSE tag END,
      three_x_ui_server_id = CASE WHEN $set_three_x_ui_server_id THEN $three_x_ui_server_id ELSE three_x_ui_server_id END,
      external_email = CASE WHEN $set_external_email THEN $external_email ELSE external_email END,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = $id
    RETURNING *`,
    )
    .get({
      id,
      user_id: attrs.user_id ?? null,
      server_id: attrs.server_id ?? null,
      config: attrs.config === undefined ? null : stripServerName(attrs.config),
      set_tag: attrs.tag !== undefined,
      tag: attrs.tag ?? null,
      set_three_x_ui_server_id: attrs.three_x_ui_server_id !== undefined,
      three_x_ui_server_id: attrs.three_x_ui_server_id ?? null,
      set_external_email: attrs.external_email !== undefined,
      external_email: attrs.external_email ?? null,
    });
}
export function remove(id: number): void {
  db()
    .query<never, { id: number }>("DELETE FROM configs WHERE id = $id")
    .run({ id });
}
export function listByPanelEmails(panelId: number): ConfigRow[] {
  return db()
    .query<ConfigRow, { panelId: number }>(
      "SELECT * FROM configs WHERE three_x_ui_server_id = $panelId",
    )
    .all({ panelId });
}
export function deleteMissingExternalEmails(
  panelId: number,
  keep: string[],
): number {
  return db()
    .query<never, { panelId: number; keep: string }>(
      `
    DELETE FROM configs
    WHERE three_x_ui_server_id = $panelId
      AND external_email NOT IN (SELECT value FROM json_each($keep))`,
    )
    .run({ panelId, keep: JSON.stringify(keep) }).changes;
}

function shapeWithServer({
  __server_name,
  ...row
}: JoinedRow): ConfigWithServer {
  return { ...row, server: { id: row.server_id, name: __server_name } };
}
