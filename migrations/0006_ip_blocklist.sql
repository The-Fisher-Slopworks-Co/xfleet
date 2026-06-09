-- migrations/0006_ip_blocklist.sql
-- Global IP blocklist applied to subscription fetches across all users.
-- cidr accepts exact IPs (implicit /32 or /128) and ranges like 192.0.2.0/24;
-- matching uses inet containment (client_ip <<= cidr).
CREATE TABLE ip_blocklist (
  id           bigserial PRIMARY KEY,
  cidr         inet NOT NULL UNIQUE,
  note         text,
  inserted_at  timestamptz(6) NOT NULL DEFAULT now()
);

CREATE INDEX ip_blocklist_cidr_gist_idx ON ip_blocklist USING gist (cidr inet_ops);
