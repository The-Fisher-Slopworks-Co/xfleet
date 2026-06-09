// src/db/integration.test.ts
import { test, expect, beforeAll, beforeEach } from "bun:test";
import { __resetSqlForTests, sql } from "./client";
import { runMigrations } from "./migrate";
import * as Users from "./users";
import * as Servers from "./servers";
import * as Configs from "./configs";
import * as ThreeXUi from "./threeXUi";
import * as SubFetchJournal from "./subFetchJournal";
import * as Devices from "./devices";
import * as IpBlocklist from "./ipBlocklist";

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
    await db`TRUNCATE users, servers, configs, three_x_ui_servers, sub_fetch_journal, devices, ip_blocklist RESTART IDENTITY CASCADE`;
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

  test("sub_fetch_journal records and lists with user join", async () => {
    const u = await Users.create({ username: "alice", token: "abc" });
    await SubFetchJournal.record({
      user_id: u.id, attempted_token: "abc", ip: "10.0.0.1",
      user_agent: "v2raytun", headers: { "user-agent": "v2raytun" }, status_code: 200,
      device_id: null, blocked_by: null,
    });
    await SubFetchJournal.record({
      user_id: null, attempted_token: "nope", ip: null,
      user_agent: null, headers: {}, status_code: 404,
      device_id: null, blocked_by: null,
    });
    const rows = await SubFetchJournal.list({ limit: 100 });
    expect(rows).toHaveLength(2);
    expect(rows[0]!.status_code).toBe(404);
    expect(rows[0]!.user).toBeNull();
    expect(rows[1]!.user?.username).toBe("alice");
    expect(rows[1]!.headers["user-agent"]).toBe("v2raytun");
    // ON DELETE SET NULL: removing the user nulls out the FK but keeps the row
    await Users.remove(u.id);
    const afterDelete = await SubFetchJournal.list({ limit: 100 });
    expect(afterDelete).toHaveLength(2);
    expect(afterDelete.every(r => r.user_id === null)).toBe(true);
  });

  test("sub_fetch_journal pruneOlderThan deletes rows past the retention window", async () => {
    const db = sql();
    const u = await Users.create({ username: "alice", token: "abc" });
    // Insert one row with a timestamp older than 91 days
    await db`
      INSERT INTO sub_fetch_journal (user_id, attempted_token, ip, user_agent, headers, status_code, inserted_at)
      VALUES (${u.id}, 'old', '1.1.1.1', 'ua', '{}'::jsonb, 200, now() - interval '91 days')`;
    // And a fresh one
    await SubFetchJournal.record({
      user_id: u.id, attempted_token: "new", ip: "1.1.1.1",
      user_agent: "ua", headers: {}, status_code: 200,
      device_id: null, blocked_by: null,
    });
    const deleted = await SubFetchJournal.pruneOlderThan(90);
    expect(deleted).toBe(1);
    const remaining = await SubFetchJournal.list({ limit: 100 });
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.attempted_token).toBe("new");
  });

  test("sub_fetch_journal pruneOlderThan returns 0 when nothing matches", async () => {
    const u = await Users.create({ username: "alice", token: "abc" });
    await SubFetchJournal.record({
      user_id: u.id, attempted_token: "new", ip: null, user_agent: null, headers: {}, status_code: 200,
      device_id: null, blocked_by: null,
    });
    expect(await SubFetchJournal.pruneOlderThan(90)).toBe(0);
  });

  test("devices block/label/listBlocked round-trip", async () => {
    const u = await Users.create({ username: "alice", token: "abc" });
    const d = await Devices.upsertByHwid({ user_id: u.id, hwid: "HW1", ua: "happ/1.0", ip: "10.0.0.1" });
    expect(d.is_blocked).toBe(false);
    expect(await Devices.listBlocked({ limit: 100 })).toHaveLength(0);
    await Devices.setBlocked(d.id, true);
    await Devices.setLabel(d.id, "old phone");
    const blocked = await Devices.listBlocked({ limit: 100 });
    expect(blocked).toHaveLength(1);
    expect(blocked[0]!.label).toBe("old phone");
    expect(blocked[0]!.user.username).toBe("alice");
    await Devices.remove(d.id);
    expect(await Devices.listForUser(u.id)).toHaveLength(0);
  });

  test("listBlocked paginates by keyset (id DESC, before_id)", async () => {
    const u = await Users.create({ username: "alice", token: "abc" });
    for (let i = 1; i <= 3; i++) {
      const d = await Devices.upsertByHwid({ user_id: u.id, hwid: `HW${i}`, ua: null, ip: null });
      await Devices.setBlocked(d.id, true);
    }
    const page1 = await Devices.listBlocked({ limit: 2 });
    expect(page1.map(d => d.hwid)).toEqual(["HW3", "HW2"]);
    const page2 = await Devices.listBlocked({ limit: 2, beforeId: page1[page1.length - 1]!.id });
    expect(page2.map(d => d.hwid)).toEqual(["HW1"]);
  });

  test("ip_blocklist CRUD and duplicate rejection", async () => {
    const row = await IpBlocklist.add({ cidr: "203.0.113.0/24", note: "abusers" });
    expect(row.id).toBeGreaterThan(0);
    expect(await IpBlocklist.list()).toHaveLength(1);
    await expect(IpBlocklist.add({ cidr: "203.0.113.0/24", note: null })).rejects.toThrow();
    expect(await IpBlocklist.isBlocked("203.0.113.42")).toBe(true);
    expect(await IpBlocklist.isBlocked("198.51.100.1")).toBe(false);
    await IpBlocklist.remove(row.id);
    expect(await IpBlocklist.list()).toHaveLength(0);
  });
}
