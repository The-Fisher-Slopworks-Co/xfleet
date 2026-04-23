-- migrations/0003_sub_fetch_journal.sql
CREATE TABLE sub_fetch_journal (
  id                bigserial PRIMARY KEY,
  user_id           bigint REFERENCES users(id) ON DELETE SET NULL,
  attempted_token   text NOT NULL,
  ip                inet,
  user_agent        text,
  headers           jsonb NOT NULL DEFAULT '{}'::jsonb,
  status_code       smallint NOT NULL,
  inserted_at       timestamptz(6) NOT NULL DEFAULT now()
);

CREATE INDEX sub_fetch_journal_user_id_idx     ON sub_fetch_journal(user_id);
CREATE INDEX sub_fetch_journal_inserted_at_idx ON sub_fetch_journal(inserted_at DESC);
