-- migrations/0001_init.sql
-- Conventions: timestamps are ISO-8601 UTC TEXT with milliseconds (the format of
-- Date#toISOString), booleans are INTEGER 0/1, JSON is TEXT.

CREATE TABLE users (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  username     TEXT NOT NULL UNIQUE,
  token        TEXT NOT NULL UNIQUE,
  inserted_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE servers (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL UNIQUE,
  inserted_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE three_x_ui_servers (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  name               TEXT NOT NULL,
  host               TEXT NOT NULL,
  port               INTEGER NOT NULL CHECK (port > 0 AND port < 65536),
  web_base_path      TEXT NOT NULL DEFAULT '/',
  username           TEXT NOT NULL,
  password           TEXT NOT NULL,
  use_tls            INTEGER NOT NULL DEFAULT 0,
  server_id          INTEGER NOT NULL REFERENCES servers(id) ON DELETE RESTRICT,
  -- Per-panel config transforms: rules that rewrite fields of a specific config
  -- (targeted by its tag = inbound remark) for every user. v1 overrides the port.
  -- Shape: [{"tag": "Port443 XHTTP", "port": 443}]
  config_transforms  TEXT NOT NULL DEFAULT '[]',
  last_synced_at     TEXT,
  last_sync_status   TEXT,
  inserted_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE configs (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id               INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  server_id             INTEGER NOT NULL REFERENCES servers(id) ON DELETE RESTRICT,
  config                TEXT NOT NULL,
  tag                   TEXT,
  three_x_ui_server_id  INTEGER REFERENCES three_x_ui_servers(id) ON DELETE SET NULL,
  external_email        TEXT,
  inserted_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (three_x_ui_server_id, external_email)
) STRICT;

CREATE INDEX configs_user_id_idx ON configs (user_id);

CREATE TABLE ext_sub_sources (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  name               TEXT NOT NULL UNIQUE,
  url                TEXT NOT NULL,
  user_agent         TEXT NOT NULL DEFAULT '',
  app_version        TEXT NOT NULL DEFAULT '',
  device_model       TEXT NOT NULL DEFAULT '',
  ver_os             TEXT NOT NULL DEFAULT '',
  device_os          TEXT NOT NULL DEFAULT '',
  hwid               TEXT NOT NULL DEFAULT '',
  last_fetched_at    TEXT,
  last_fetch_status  TEXT,
  inserted_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE ext_sub_links (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id    INTEGER NOT NULL REFERENCES ext_sub_sources(id) ON DELETE CASCADE,
  uri          TEXT NOT NULL,
  label        TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  inserted_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE INDEX ext_sub_links_source_id_idx ON ext_sub_links (source_id);

CREATE TABLE ext_sub_user_sources (
  source_id    INTEGER NOT NULL REFERENCES ext_sub_sources(id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (source_id, user_id)
) STRICT;

CREATE INDEX ext_sub_user_sources_user_id_idx ON ext_sub_user_sources (user_id);

-- Device registry: one row per known client device per user.
-- Identity is either the x-hwid header (canonical) or, when the client
-- sends no hwid, the (user_agent, ip) pair observed on subscription fetches.
CREATE TABLE devices (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hwid           TEXT,
  fallback_ua    TEXT,
  fallback_ip    TEXT,
  label          TEXT,
  last_ua        TEXT,
  last_ip        TEXT,
  is_blocked     INTEGER NOT NULL DEFAULT 0,
  first_seen_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_seen_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- A device is identified either by hwid (fallback columns unused)
  -- or by the (user_agent, ip) pair (both required).
  CONSTRAINT devices_identity_check CHECK (
    (hwid IS NOT NULL AND fallback_ua IS NULL AND fallback_ip IS NULL)
    OR (hwid IS NULL AND fallback_ua IS NOT NULL AND fallback_ip IS NOT NULL)
  )
) STRICT;

CREATE UNIQUE INDEX devices_user_hwid_idx
  ON devices (user_id, hwid) WHERE hwid IS NOT NULL;
CREATE UNIQUE INDEX devices_user_fallback_idx
  ON devices (user_id, fallback_ua, fallback_ip) WHERE hwid IS NULL;
CREATE INDEX devices_user_id_idx ON devices (user_id);
-- Keyed on id so it serves the keyset-paginated blocked list (ORDER BY id DESC).
CREATE INDEX devices_is_blocked_idx ON devices (id) WHERE is_blocked = 1;

CREATE TABLE sub_fetch_journal (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id           INTEGER REFERENCES users(id) ON DELETE SET NULL,
  attempted_token   TEXT NOT NULL,
  ip                TEXT,
  user_agent        TEXT,
  headers           TEXT NOT NULL DEFAULT '{}',
  status_code       INTEGER NOT NULL,
  -- The device that made the fetch and why a request was denied
  -- (blocked_by: 'device' | 'ip' | NULL = not blocked).
  device_id         INTEGER REFERENCES devices(id) ON DELETE SET NULL,
  blocked_by        TEXT,
  inserted_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE INDEX sub_fetch_journal_inserted_at_idx ON sub_fetch_journal (inserted_at);
-- The per-user keyset query filters on user_id and orders by id DESC.
CREATE INDEX sub_fetch_journal_user_id_id_idx ON sub_fetch_journal (user_id, id DESC);
CREATE INDEX sub_fetch_journal_device_id_idx
  ON sub_fetch_journal (device_id) WHERE device_id IS NOT NULL;

-- Global IP blocklist applied to subscription fetches across all users.
-- cidr holds an exact IP or a range like 192.0.2.0/24 in the canonical form
-- produced by src/shared/ip.ts; matching happens in application code.
CREATE TABLE ip_blocklist (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  cidr         TEXT NOT NULL UNIQUE,
  note         TEXT,
  inserted_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;
