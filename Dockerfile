# syntax=docker/dockerfile:1.7

# ---- deps: install dependencies (cacheable layer) ----
FROM oven/bun:1-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ---- builder: compile server + frontend into a single self-contained binary ----
# `src/server/index.ts` imports `../frontend/index.html`, so Bun's bundler
# pulls in the whole frontend (Tailwind plugin, TSX, CSS) at build time.
# `--compile` embeds the client assets (JS/CSS) into the executable itself so
# the runtime has no bundler, no node_modules, and no separate asset files.
FROM deps AS builder
WORKDIR /app
COPY . .
RUN bun run build-server.ts

# ---- runtime: minimal image, just the binary and migrations ----
FROM oven/bun:1-alpine AS runtime
WORKDIR /app
COPY --from=builder --chown=bun:bun /app/dist/app /app/app
COPY --from=builder --chown=bun:bun /app/migrations /app/migrations
USER bun
ENV NODE_ENV=production
EXPOSE 3000
CMD ["/app/app"]
