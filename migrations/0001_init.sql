-- migrations/0001_init.sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version     text PRIMARY KEY,
  applied_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id           bigserial PRIMARY KEY,
  username     text NOT NULL UNIQUE,
  token        text NOT NULL UNIQUE,
  inserted_at  timestamptz(6) NOT NULL DEFAULT now(),
  updated_at   timestamptz(6) NOT NULL DEFAULT now()
);

CREATE TABLE servers (
  id           bigserial PRIMARY KEY,
  name         text NOT NULL UNIQUE,
  inserted_at  timestamptz(6) NOT NULL DEFAULT now(),
  updated_at   timestamptz(6) NOT NULL DEFAULT now()
);

CREATE TABLE three_x_ui_servers (
  id                bigserial PRIMARY KEY,
  name              text NOT NULL,
  host              text NOT NULL,
  port              integer NOT NULL CHECK (port > 0 AND port < 65536),
  web_base_path     text NOT NULL DEFAULT '/',
  username          text NOT NULL,
  password          text NOT NULL,
  use_tls           boolean NOT NULL DEFAULT false,
  server_id         bigint NOT NULL REFERENCES servers(id) ON DELETE RESTRICT,
  last_synced_at    timestamptz(6),
  last_sync_status  text,
  inserted_at       timestamptz(6) NOT NULL DEFAULT now(),
  updated_at        timestamptz(6) NOT NULL DEFAULT now()
);

CREATE TABLE configs (
  id                    bigserial PRIMARY KEY,
  user_id               bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  server_id             bigint NOT NULL REFERENCES servers(id) ON DELETE RESTRICT,
  config                text NOT NULL,
  tag                   text,
  three_x_ui_server_id  bigint REFERENCES three_x_ui_servers(id) ON DELETE SET NULL,
  external_email        text,
  inserted_at           timestamptz(6) NOT NULL DEFAULT now(),
  updated_at            timestamptz(6) NOT NULL DEFAULT now(),
  UNIQUE (three_x_ui_server_id, external_email)
);

CREATE INDEX configs_user_id_idx ON configs(user_id);
CREATE INDEX configs_three_x_ui_server_id_idx ON configs(three_x_ui_server_id);
