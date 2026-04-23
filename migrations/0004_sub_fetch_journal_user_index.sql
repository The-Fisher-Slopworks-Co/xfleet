-- migrations/0004_sub_fetch_journal_user_index.sql
-- The per-user keyset query filters on user_id and orders by id DESC.
-- Replace the user_id-only index with a composite that supports both.
DROP INDEX IF EXISTS sub_fetch_journal_user_id_idx;
CREATE INDEX sub_fetch_journal_user_id_id_idx
  ON sub_fetch_journal (user_id, id DESC);
