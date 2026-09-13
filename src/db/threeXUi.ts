// src/db/threeXUi.ts
import { db, type Bindings } from "./client";
import type { ConfigTransform } from "../shared/schemas";

export type ThreeXUiRow = {
  id: number;
  name: string;
  host: string;
  port: number;
  web_base_path: string;
  username: string;
  password: string;
  use_tls: boolean;
  server_id: number;
  config_transforms: ConfigTransform[];
  last_synced_at: string | null;
  last_sync_status: string | null;
  inserted_at: string;
  updated_at: string;
};
export type ThreeXUiWithVpnServer = ThreeXUiRow & { vpn_server: { id: number; name: string } };

type RawRow = Omit<ThreeXUiRow, "use_tls" | "config_transforms"> & { use_tls: number; config_transforms: string };

export function list(): ThreeXUiWithVpnServer[] {
  return db().query<RawRow & { __server_name: string }, []>(`
    SELECT t.*, s.name AS __server_name
    FROM three_x_ui_servers t JOIN servers s ON s.id = t.server_id
    ORDER BY t.name ASC`).all().map(shape);
}
export function get(id: number): ThreeXUiWithVpnServer | null {
  const row = db().query<RawRow & { __server_name: string }, { id: number }>(`
    SELECT t.*, s.name AS __server_name
    FROM three_x_ui_servers t JOIN servers s ON s.id = t.server_id
    WHERE t.id = $id`).get({ id });
  return row ? shape(row) : null;
}
export function create(attrs: {
  name: string; host: string; port: number; web_base_path: string; username: string;
  password: string; use_tls: boolean; server_id: number; config_transforms?: ConfigTransform[];
}): ThreeXUiRow {
  return shapeThreeXUi(db().query<RawRow, Bindings>(`
    INSERT INTO three_x_ui_servers (name, host, port, web_base_path, username, password, use_tls, server_id, config_transforms)
    VALUES ($name, $host, $port, $web_base_path,
            $username, $password, $use_tls, $server_id,
            $config_transforms)
    RETURNING *`).get({
    name: attrs.name,
    host: attrs.host,
    port: attrs.port,
    web_base_path: attrs.web_base_path,
    username: attrs.username,
    password: attrs.password,
    use_tls: attrs.use_tls,
    server_id: attrs.server_id,
    config_transforms: JSON.stringify(attrs.config_transforms ?? []),
  })!);
}
export function update(id: number, attrs: Partial<{
  name: string; host: string; port: number; web_base_path: string; username: string;
  password: string; use_tls: boolean; server_id: number; config_transforms: ConfigTransform[];
}>): ThreeXUiRow | null {
  const row = db().query<RawRow, Bindings>(`
    UPDATE three_x_ui_servers SET
      name = COALESCE($name, name),
      host = COALESCE($host, host),
      port = COALESCE($port, port),
      web_base_path = COALESCE($web_base_path, web_base_path),
      username = COALESCE($username, username),
      password = COALESCE($password, password),
      use_tls = COALESCE($use_tls, use_tls),
      server_id = COALESCE($server_id, server_id),
      config_transforms = COALESCE($config_transforms, config_transforms),
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = $id
    RETURNING *`).get({
    id,
    name: attrs.name ?? null,
    host: attrs.host ?? null,
    port: attrs.port ?? null,
    web_base_path: attrs.web_base_path ?? null,
    username: attrs.username ?? null,
    password: attrs.password ?? null,
    use_tls: attrs.use_tls ?? null,
    server_id: attrs.server_id ?? null,
    // undefined keeps the stored transforms; [] clears them
    config_transforms: attrs.config_transforms === undefined ? null : JSON.stringify(attrs.config_transforms),
  });
  return row ? shapeThreeXUi(row) : null;
}
export function remove(id: number): void {
  db().query<never, { id: number }>("DELETE FROM three_x_ui_servers WHERE id = $id").run({ id });
}
export function updateSyncStatus(id: number, at: Date, status: string): void {
  db().query<never, { id: number; at: string; status: string }>(`
    UPDATE three_x_ui_servers
    SET last_synced_at = $at, last_sync_status = $status, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = $id`).run({ id, at: at.toISOString(), status });
}

// Values are written through Zod, so trust the stored shape.
function shapeThreeXUi(r: RawRow): ThreeXUiRow {
  return { ...r, use_tls: r.use_tls === 1, config_transforms: JSON.parse(r.config_transforms) as ConfigTransform[] };
}

function shape({ __server_name, ...rest }: RawRow & { __server_name: string }): ThreeXUiWithVpnServer {
  const base = shapeThreeXUi(rest);
  return { ...base, vpn_server: { id: base.server_id, name: __server_name } };
}
