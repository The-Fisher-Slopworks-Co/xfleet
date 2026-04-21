-- migrations/0002_ext_sub.sql
CREATE TABLE ext_sub_sources (
  id                 bigserial PRIMARY KEY,
  name               text NOT NULL UNIQUE,
  url                text NOT NULL,
  user_agent         text NOT NULL DEFAULT '',
  app_version        text NOT NULL DEFAULT '',
  device_model       text NOT NULL DEFAULT '',
  ver_os             text NOT NULL DEFAULT '',
  device_os          text NOT NULL DEFAULT '',
  hwid               text NOT NULL DEFAULT '',
  last_fetched_at    timestamptz(6),
  last_fetch_status  text,
  inserted_at        timestamptz(6) NOT NULL DEFAULT now(),
  updated_at         timestamptz(6) NOT NULL DEFAULT now()
);

CREATE TABLE ext_sub_links (
  id           bigserial PRIMARY KEY,
  source_id    bigint NOT NULL REFERENCES ext_sub_sources(id) ON DELETE CASCADE,
  uri          text NOT NULL,
  label        text,
  sort_order   integer NOT NULL DEFAULT 0,
  inserted_at  timestamptz(6) NOT NULL DEFAULT now()
);

CREATE INDEX ext_sub_links_source_id_idx ON ext_sub_links(source_id);

CREATE TABLE ext_sub_user_sources (
  source_id    bigint NOT NULL REFERENCES ext_sub_sources(id) ON DELETE CASCADE,
  user_id      bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at  timestamptz(6) NOT NULL DEFAULT now(),
  PRIMARY KEY (source_id, user_id)
);

CREATE INDEX ext_sub_user_sources_user_id_idx ON ext_sub_user_sources(user_id);
