-- migrations/0007_journal_device.sql
-- Link journal rows to the device that made the fetch and record why
-- a request was denied (blocked_by: 'device' | 'ip' | NULL = not blocked).
ALTER TABLE sub_fetch_journal
  ADD COLUMN device_id  bigint REFERENCES devices(id) ON DELETE SET NULL,
  ADD COLUMN blocked_by text;

CREATE INDEX sub_fetch_journal_device_id_idx
  ON sub_fetch_journal (device_id) WHERE device_id IS NOT NULL;
