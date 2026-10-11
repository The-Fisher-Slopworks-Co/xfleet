# xfleet

An admin panel that sits in front of [3X-UI](https://github.com/MHSanaei/3x-ui).

3X-UI is fine with one server and a few clients. Once you have more of either, you end up logging into separate panels, copying UUIDs around, and pasting share links into chats by hand. xfleet does that part for you — add a user once, it shows up on every server, with a share link you can send.

Useful if you're self-hosting a VPN for yourself and a few people and don't want it to feel like a job.

## Prereqs

- Bun >= 1.2

Data lives in a single SQLite file at `DATABASE_PATH` (default in `.env.example`: `data/xfleet.db`).

## Setup

```sh
cp .env.example .env
# generate secrets
openssl rand -hex 32                    # SESSION_SECRET
openssl rand -base64 32                 # MASTER_KEY
bun scripts/hash-password.ts 'pass'     # ADMIN_PASSWORD_HASH
# then fill .env manually
# NOTE: ADMIN_PASSWORD_HASH must be double-quoted with \$ escaping in .env:
#   ADMIN_PASSWORD_HASH="\$2b\$10\$..."
# Both docker compose and Bun's dotenv loader correctly strip \$ → $.

bun install
bun run migrate
bun run dev
```

## Tests

```sh
bun test    # DB tests run against in-memory SQLite, no setup needed
```

## Deploy

Production command:

```sh
bun run migrate
bun run start
```

The SSE endpoint `/api/admin/events` requires `proxy_buffering off;` (nginx) or equivalent.

## Docker

A production example lives in `docker-compose.yml`.

```sh
cp .env.example .env
# fill the same secrets as the non-docker setup
docker compose up -d
```

The app runs migrations automatically on container start and publishes port 3000. The database is stored in the `xfleet_data` volume at `/app/data/xfleet.db`. Stop the container before copying it for a backup — the database runs in WAL mode, so a copy taken while it is live can be inconsistent. Put your own reverse proxy (nginx/Caddy/etc.) in front — remember `proxy_buffering off;` for the SSE endpoint, and bind to `127.0.0.1:3000` in the compose file if you don't want port 3000 publicly exposed on the host.

## License

AGPL-3.0-or-later. See [LICENSE](LICENSE).
