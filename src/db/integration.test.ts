// src/db/integration.test.ts
import { test, expect, beforeAll, beforeEach } from "bun:test";
import { __resetSqlForTests, sql } from "./client";
import { runMigrations } from "./migrate";
import * as Users from "./users";
import * as Servers from "./servers";
import * as Configs from "./configs";
import * as ThreeXUi from "./threeXUi";

const TEST_URL = process.env.TEST_DATABASE_URL;
if (!TEST_URL) {
  test.skip("integration tests skipped (set TEST_DATABASE_URL)", () => {});
} else {
  beforeAll(async () => {
    __resetSqlForTests(TEST_URL);
    await runMigrations();
  });
  beforeEach(async () => {
    const db = sql();
    await db`TRUNCATE users, servers, configs, three_x_ui_servers RESTART IDENTITY CASCADE`;
  });

  test("users CRUD round-trip", async () => {
    const u = await Users.create({ username: "alice", token: "tok1" });
    expect(u.id).toBeGreaterThan(0);
    const list = await Users.list();
    expect(list.map(r => r.username)).toEqual(["alice"]);
    const byTok = await Users.getByToken("tok1");
    expect(byTok?.username).toBe("alice");
    const byName = await Users.getByUsername("alice");
    expect(byName?.id).toBe(u.id);
    const upd = await Users.update(u.id, { username: "alice2", token: "tok1" });
    expect(upd.username).toBe("alice2");
    await Users.remove(u.id);
    expect(await Users.list()).toEqual([]);
  });

  test("username regex enforced by unique constraint coordination", async () => {
    await Users.create({ username: "a", token: "t1" });
    await expect(Users.create({ username: "a", token: "t2" })).rejects.toThrow();
  });

  test("servers CRUD", async () => {
    const s = await Servers.create({ name: "eu-1" });
    expect(await Servers.list()).toHaveLength(1);
    const upd = await Servers.update(s.id, { name: "eu-2" });
    expect(upd.name).toBe("eu-2");
    await Servers.remove(s.id);
  });

  test("configs CRUD nested under user", async () => {
    const u = await Users.create({ username: "u", token: "t" });
    const s = await Servers.create({ name: "s" });
    const c = await Configs.create({ user_id: u.id, server_id: s.id, config: "vless://x#s", tag: "prem" });
    expect(c.config).toBe("vless://x"); // server suffix stripped
    const list = await Configs.listForUser(u.id);
    expect(list).toHaveLength(1);
    expect(list[0]!.server.name).toBe("s");
    await Configs.update(c.id, { tag: null });
    await Configs.remove(c.id);
  });

  test("three_x_ui CRUD and sync-status update", async () => {
    const s = await Servers.create({ name: "s" });
    const t = await ThreeXUi.create({
      name: "panel", host: "p.example", port: 2053, web_base_path: "/", username: "u",
      password: "enc-pass", use_tls: true, server_id: s.id,
    });
    expect(t.id).toBeGreaterThan(0);
    const list = await ThreeXUi.list();
    expect(list).toHaveLength(1);
    expect(list[0]!.vpn_server.name).toBe("s");
    await ThreeXUi.updateSyncStatus(t.id, new Date(), "ok");
    const after = await ThreeXUi.get(t.id);
    expect(after?.last_sync_status).toBe("ok");
  });
}
