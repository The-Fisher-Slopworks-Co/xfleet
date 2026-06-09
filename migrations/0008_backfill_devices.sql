-- migrations/0008_backfill_devices.sql
-- Seed the devices table from the existing fetch journal and link
-- historical journal rows to the devices extracted from them.
-- 256 below mirrors MAX_HWID_LEN in src/server/clientIp.ts.

-- 1. Devices identified by the x-hwid header.
INSERT INTO devices (user_id, hwid, last_ua, last_ip, first_seen_at, last_seen_at)
SELECT
  user_id,
  left(headers->>'x-hwid', 256),
  (array_agg(user_agent ORDER BY id DESC))[1],
  (array_agg(ip ORDER BY id DESC))[1],
  min(inserted_at),
  max(inserted_at)
FROM sub_fetch_journal
WHERE user_id IS NOT NULL
  AND nullif(headers->>'x-hwid', '') IS NOT NULL
GROUP BY user_id, left(headers->>'x-hwid', 256);

-- 2. Fallback devices from (user_agent, ip) pairs that never sent a hwid.
--    Pairs that also appear with a hwid are skipped: those fetches belong to
--    a hwid-identified device created above (mirrors live promotion logic).
INSERT INTO devices (user_id, fallback_ua, fallback_ip, last_ua, last_ip, first_seen_at, last_seen_at)
SELECT
  j.user_id, j.user_agent, j.ip, j.user_agent, j.ip,
  min(j.inserted_at), max(j.inserted_at)
FROM sub_fetch_journal j
WHERE j.user_id IS NOT NULL
  AND nullif(j.headers->>'x-hwid', '') IS NULL
  AND j.user_agent IS NOT NULL
  AND j.ip IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sub_fetch_journal h
    WHERE h.user_id = j.user_id
      AND h.user_agent = j.user_agent
      AND h.ip = j.ip
      AND nullif(h.headers->>'x-hwid', '') IS NOT NULL
  )
GROUP BY j.user_id, j.user_agent, j.ip;

-- 3. Link historical journal rows to the devices created above.
UPDATE sub_fetch_journal j
SET device_id = d.id
FROM devices d
WHERE d.user_id = j.user_id
  AND d.hwid IS NOT NULL
  AND d.hwid = left(j.headers->>'x-hwid', 256);

UPDATE sub_fetch_journal j
SET device_id = d.id
FROM devices d
WHERE d.user_id = j.user_id
  AND d.hwid IS NULL
  AND nullif(j.headers->>'x-hwid', '') IS NULL
  AND d.fallback_ua = j.user_agent
  AND d.fallback_ip = j.ip;
