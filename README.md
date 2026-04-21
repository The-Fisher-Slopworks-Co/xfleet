# eui

An admin panel that sits in front of [3X-UI](https://github.com/MHSanaei/3x-ui).

3X-UI is fine with one server and a few clients. Once you have more of either, you end up logging into separate panels, copying UUIDs around, and pasting share links into chats by hand. eui does that part for you — add a user once, it shows up on every server, with a share link you can send.

Useful if you're self-hosting a VPN for yourself and a few people and don't want it to feel like a job.

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
