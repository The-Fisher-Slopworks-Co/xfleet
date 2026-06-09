-- migrations/0005_devices.sql
-- Device registry: one row per known client device per user.
-- Identity is either the x-hwid header (canonical) or, when the client
-- sends no hwid, the (user_agent, ip) pair observed on subscription fetches.
CREATE TABLE devices (
  id             bigserial PRIMARY KEY,
  user_id        bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hwid           text,
  fallback_ua    text,
  fallback_ip    inet,
  label          text,
  last_ua        text,
  last_ip        inet,
  is_blocked     boolean NOT NULL DEFAULT false,
  first_seen_at  timestamptz(6) NOT NULL DEFAULT now(),
  last_seen_at   timestamptz(6) NOT NULL DEFAULT now(),
  -- A device is identified either by hwid (fallback columns unused)
  -- or by the (user_agent, ip) pair (both required).
  CONSTRAINT devices_identity_check CHECK (
    (hwid IS NOT NULL AND fallback_ua IS NULL AND fallback_ip IS NULL)
    OR (hwid IS NULL AND fallback_ua IS NOT NULL AND fallback_ip IS NOT NULL)
  )
);

CREATE UNIQUE INDEX devices_user_hwid_idx
  ON devices (user_id, hwid) WHERE hwid IS NOT NULL;
CREATE UNIQUE INDEX devices_user_fallback_idx
  ON devices (user_id, fallback_ua, fallback_ip) WHERE hwid IS NULL;
CREATE INDEX devices_user_id_idx ON devices (user_id);
-- Keyed on id so it serves the keyset-paginated blocked list (ORDER BY id DESC).
CREATE INDEX devices_is_blocked_idx ON devices (id) WHERE is_blocked = true;
