import { test, expect, beforeAll, beforeEach } from "bun:test";
import { __resetSqlForTests, sql } from "../../db/client";
import { runMigrations } from "../../db/migrate";
import * as Users from "../../db/users";
import * as Servers from "../../db/servers";
import * as Configs from "../../db/configs";
import { subscriptionRoutes } from "./subscription";
import type { Env } from "../env";

const TEST_URL = process.env.TEST_DATABASE_URL;
if (!TEST_URL) {
  test.skip("subscription test skipped", () => {});
} else {
  beforeAll(async () => {
    __resetSqlForTests(TEST_URL);
    await runMigrations();
  });
  beforeEach(async () => {
    const db = sql();
    await db`TRUNCATE users, servers, configs, three_x_ui_servers RESTART IDENTITY CASCADE`;
  });

  const env = {
    profileTitle: "VPN", adminUsername: "", adminPasswordHash: "", sessionSecret: "",
    masterKey: "", databaseUrl: "", port: 0, publicBaseUrl: "",
  } satisfies Env;

  test("unknown token returns 404", async () => {
    const routes = subscriptionRoutes(env);
    const res = await routes["/sub/:token"].GET(
      Object.assign(new Request("http://x/sub/nope"), { params: { token: "nope" } }),
    );
    expect(res.status).toBe(404);
  });

  test("returns concatenated configs with profile-title header", async () => {
    const u = await Users.create({ username: "alice", token: "abc" });
    const s = await Servers.create({ name: "eu" });
    await Configs.create({ user_id: u.id, server_id: s.id, config: "vless://x", tag: "prem" });
    await Configs.create({ user_id: u.id, server_id: s.id, config: "vless://y", tag: null });
    const routes = subscriptionRoutes(env);
    const res = await routes["/sub/:token"].GET(
      Object.assign(new Request("http://x/sub/abc"), { params: { token: "abc" } }),
    );
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toBe("vless://x#eu%20prem\nvless://y#eu");
    const title = res.headers.get("profile-title")!;
    expect(title.startsWith("base64:")).toBe(true);
    const decoded = Buffer.from(title.slice("base64:".length), "base64").toString();
    expect(decoded).toBe("VPN - alice");
  });
}
