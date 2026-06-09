# xfleet

Admin panel that sits in front of [3X-UI](https://github.com/MHSanaei/3x-ui) — manage
VPN users/servers once, sync to every 3X-UI panel, hand out subscription share links.
Bun + Postgres + React 19 SPA. See README.md for setup/deploy.

## Commands

```sh
bun run dev          # hot-reload server (serves API + SPA) on PORT (default 3000)
bun run migrate      # apply migrations/*.sql in order
bun run hash-password 'pass'   # generate ADMIN_PASSWORD_HASH
bun run start        # production (NODE_ENV=production)

# Tests need a real Postgres — they are NOT pure unit tests:
createdb xfleet_test
TEST_DATABASE_URL=postgres://$USER@localhost:5432/xfleet_test bun test
```

## Architecture

Layered, one direction of dependency: `frontend → server → domain → db`.

- `src/db/` — data access, one module per entity (`users.ts`, `servers.ts`, …). Uses a
  `Bun.sql` singleton via `sql()` in `db/client.ts`. **bun:sql returns numeric columns
  as strings** — wrap with `toNum`/`toNumOrNull` from `db/client.ts`.
- `src/domain/` — business logic (crypto, sync, scheduler, ext-sub parsing). Mostly
  pure and unit-tested.
- `src/server/` — `Bun.serve` HTTP routes. Each `routes/*.ts` exports a **factory**
  (e.g. `usersRoutes(env)`) returning a route map; all are spread together in
  `server/index.ts`. Auth via `requireAuth` + a `guard()` helper at the top of each
  handler. SSE fan-out through `sseHub`.
- `src/shared/schemas.ts` — Zod schemas shared by client and server for validation.
- `src/frontend/` — React Router SPA. `index.html` is imported by the server; `/*`
  falls back to it. Terminal-themed UI in `components/terminal/`, shadcn in
  `components/ui/`.
- `migrations/` — raw numbered SQL, applied in a tx and tracked in `schema_migrations`.

## Gotchas

- **Migrations run automatically on server start** (`runMigrations()` in `index.ts`).
- 3X-UI credentials are encrypted at rest with `MASTER_KEY` via `domain/crypto.ts`.
- `ADMIN_PASSWORD_HASH` in `.env` must be double-quoted with `\$` escaping (see README).
- The SSE endpoint `/api/admin/events` needs `proxy_buffering off;` behind nginx.
- Set `TRUST_PROXY=true` behind a reverse proxy so client IPs resolve from XFF.

---

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";
import { createRoot } from "react-dom/client";

// import .css files directly and it works
import './index.css';

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.
