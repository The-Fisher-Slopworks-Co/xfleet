# e_ui_ts

Bun + TypeScript rebuild of the Elixir `e_ui` VPN admin panel, schema-compatible with the original.

## Prereqs

- Bun >= 1.2
- Postgres 14+

## Setup

# For local dev, `docker compose up -d` starts Postgres with the `eui` and `eui_test` databases pre-created.

```sh
cp .env.example .env
# generate secrets
openssl rand -hex 32                    # SESSION_SECRET
openssl rand -base64 32                 # MASTER_KEY
bun scripts/hash-password.ts 'pass'     # ADMIN_PASSWORD_HASH
# then fill .env manually

createdb eui
bun install
bun run migrate
bun run dev
```

## One-shot migration from the Elixir app

Copy `OLD_DATABASE_URL`, `OLD_SECRET_KEY_BASE` into `.env`, then:

```sh
bun run migrate:elixir -- --dry-run   # inspect
bun run migrate:elixir -- --force     # actually write (destination must be empty)
```

## Tests

```sh
createdb eui_test
TEST_DATABASE_URL=postgres://$USER@localhost:5432/eui_test bun test
```

## Deploy

Production command:

```sh
bun run build
bun run migrate
bun run start
```

The SSE endpoint `/api/admin/events` requires `proxy_buffering off;` (nginx) or equivalent.
