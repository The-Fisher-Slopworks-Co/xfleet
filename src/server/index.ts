// src/server/index.ts
import { loadEnv } from "./env";
import { runMigrations } from "../db/migrate";
import { makeCipher } from "../domain/crypto";
import { makeSseHub } from "./sseHub";
import { startScheduler } from "../domain/scheduler";
import { authRoutes } from "./routes/auth";
import { usersRoutes } from "./routes/users";
import { serversRoutes } from "./routes/servers";
import { configsRoutes } from "./routes/configs";
import { threeXUiRoutes } from "./routes/threeXUi";
import { subscriptionRoutes } from "./routes/subscription";
import { eventsRoutes } from "./routes/events";
import index from "../frontend/index.html";

const env = loadEnv();
await runMigrations();
const cipher = await makeCipher(env.masterKey);
const hub = makeSseHub();

const routes = {
  "/sub/:token": subscriptionRoutes(env)["/sub/:token"],
  ...authRoutes(env),
  ...usersRoutes(env),
  ...serversRoutes(env),
  ...configsRoutes(env),
  ...threeXUiRoutes(env, cipher, hub),
  ...eventsRoutes(env, hub),
  // SPA fallback — serve index.html for all unmatched routes
  "/*": index,
};

startScheduler({ hub, cipher });

const server = Bun.serve({
  port: env.port,
  routes,
  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
  error(err) {
    console.error("[server]", err);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  },
});

console.log(`🚀 eui_ts running at ${server.url}`);
