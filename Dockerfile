# syntax=docker/dockerfile:1.7

# ---- deps: install dependencies (cacheable layer) ----
FROM oven/bun:1-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ---- builder: copy source ----
# Bun.serve() bundles HTML/TSX/CSS via [serve.static] at request time
# (see bunfig.toml), so no `bun run build` step is needed here.
FROM deps AS builder
WORKDIR /app
COPY . .

# ---- runtime: minimal image that runs the server ----
FROM oven/bun:1-alpine AS runtime
WORKDIR /app
COPY --from=builder --chown=bun:bun /app /app
USER bun
ENV NODE_ENV=production
EXPOSE 3000
CMD ["bun", "run", "start"]
