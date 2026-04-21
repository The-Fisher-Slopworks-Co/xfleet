import { test, expect, beforeAll, beforeEach } from "bun:test";
import { __resetSqlForTests, sql } from "../../db/client";
import { runMigrations } from "../../db/migrate";
import * as Users from "../../db/users";
import * as Servers from "../../db/servers";
import * as Configs from "../../db/configs";
import * as ExtSubSources from "../../db/extSubSources";
import * as ExtSubLinks from "../../db/extSubLinks";
import * as ExtSubAssignments from "../../db/extSubAssignments";
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
    await db`TRUNCATE users, servers, configs, three_x_ui_servers,
             ext_sub_sources, ext_sub_links, ext_sub_user_sources RESTART IDENTITY CASCADE`;
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

  test("appends ext-sub lines with source-prefixed labels for assigned users", async () => {
    const u = await Users.create({ username: "alice", token: "abc" });
    const s = await Servers.create({ name: "eu" });
    await Configs.create({ user_id: u.id, server_id: s.id, config: "vless://x", tag: null });
    const src = await ExtSubSources.create({
      name: "provX", url: "v1:enc",
      user_agent: "ua", app_version: "", device_model: "", ver_os: "", device_os: "", hwid: "",
    });
    await ExtSubLinks.replaceForSource(src.id, [
      { uri: "vless://ext1", label: "HK-01" },
      { uri: "vmess://ext2", label: null },
    ]);
    await ExtSubAssignments.setForUser(u.id, [src.id]);

    const routes = subscriptionRoutes(env);
    const res = await routes["/sub/:token"].GET(
      Object.assign(new Request("http://x/sub/abc"), { params: { token: "abc" } }),
    );
    const body = await res.text();
    const lines = body.split("\n");
    expect(lines[0]).toBe("vless://x#eu");
    expect(lines[1]).toBe(`vless://ext1#${encodeURIComponent("provX · HK-01")}`);
    expect(lines[2]).toBe("vmess://ext2#provX");
  });

  test("ext-sub lines excluded when user has no assignment", async () => {
    const u = await Users.create({ username: "alice", token: "abc" });
    const s = await Servers.create({ name: "eu" });
    await Configs.create({ user_id: u.id, server_id: s.id, config: "vless://x", tag: null });
    const src = await ExtSubSources.create({
      name: "provX", url: "v1:enc",
      user_agent: "ua", app_version: "", device_model: "", ver_os: "", device_os: "", hwid: "",
    });
    await ExtSubLinks.replaceForSource(src.id, [{ uri: "vless://ext1", label: null }]);
    // No assignment

    const routes = subscriptionRoutes(env);
    const res = await routes["/sub/:token"].GET(
      Object.assign(new Request("http://x/sub/abc"), { params: { token: "abc" } }),
    );
    const body = await res.text();
    expect(body).toBe("vless://x#eu");
  });
}
