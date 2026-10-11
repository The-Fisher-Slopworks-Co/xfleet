// src/db/integration.test.ts
import { test, expect, beforeAll, beforeEach } from "bun:test";
import { __resetDbForTests, __truncateForTests, db } from "./client";
import { runMigrations } from "./migrate";
import * as Users from "./users";
import * as Servers from "./servers";
import * as Configs from "./configs";
import * as ThreeXUi from "./threeXUi";
import * as SubFetchJournal from "./subFetchJournal";
import * as Devices from "./devices";
import * as IpBlocklist from "./ipBlocklist";

beforeAll(async () => {
  __resetDbForTests();
  await runMigrations();
});
beforeEach(() => {
  __truncateForTests();
});

test("users CRUD round-trip", async () => {
  const u = Users.create({ username: "alice", token: "tok1" });
  expect(u.id).toBeGreaterThan(0);
  const list = Users.list();
  expect(list.map((r) => r.username)).toEqual(["alice"]);
  const byTok = Users.getByToken("tok1");
  expect(byTok?.username).toBe("alice");
  const byName = Users.getByUsername("alice");
  expect(byName?.id).toBe(u.id);
  const upd = Users.update(u.id, { username: "alice2", token: "tok1" });
  expect(upd?.username).toBe("alice2");
  expect(Users.update(999, { username: "ghost" })).toBeNull();
  Users.remove(u.id);
  expect(Users.list()).toEqual([]);
});

test("username regex enforced by unique constraint coordination", async () => {
  Users.create({ username: "a", token: "t1" });
  expect(() => Users.create({ username: "a", token: "t2" })).toThrow(
    /UNIQUE.*username/,
  );
});

test("servers CRUD", async () => {
  const s = Servers.create({ name: "eu-1" });
  expect(Servers.list()).toHaveLength(1);
  const upd = Servers.update(s.id, { name: "eu-2" });
  expect(upd?.name).toBe("eu-2");
  Servers.remove(s.id);
});

test("configs CRUD nested under user", async () => {
  const u = Users.create({ username: "u", token: "t" });
  const s = Servers.create({ name: "s" });
  const c = Configs.create({
    user_id: u.id,
    server_id: s.id,
    config: "vless://x#s",
    tag: "prem",
  });
  expect(c.config).toBe("vless://x"); // server suffix stripped
  const list = Configs.listForUser(u.id);
  expect(list).toHaveLength(1);
  expect(list[0]!.server.name).toBe("s");
  Configs.update(c.id, { tag: null });
  Configs.remove(c.id);
});

test("three_x_ui CRUD and sync-status update", async () => {
  const s = Servers.create({ name: "s" });
  const t = ThreeXUi.create({
    name: "panel",
    host: "p.example",
    port: 2053,
    web_base_path: "/",
    username: "u",
    password: "enc-pass",
    use_tls: true,
    server_id: s.id,
  });
  expect(t.id).toBeGreaterThan(0);
  const list = ThreeXUi.list();
  expect(list).toHaveLength(1);
  expect(list[0]!.vpn_server.name).toBe("s");
  ThreeXUi.updateSyncStatus(t.id, new Date(), "ok");
  const after = ThreeXUi.get(t.id);
  expect(after?.last_sync_status).toBe("ok");
});

test("three_x_ui config_transforms round-trip: omit keeps, [] clears", async () => {
  const s = Servers.create({ name: "ct" });
  const t = ThreeXUi.create({
    name: "panel",
    host: "p.example",
    port: 2053,
    web_base_path: "/",
    username: "u",
    password: "enc-pass",
    use_tls: true,
    server_id: s.id,
    config_transforms: [{ tag: "Port443 XHTTP", port: 443 }],
  });
  expect(ThreeXUi.get(t.id)?.config_transforms).toEqual([
    { tag: "Port443 XHTTP", port: 443 },
  ]);
  // update that omits the field must preserve existing transforms
  ThreeXUi.update(t.id, { name: "renamed" });
  expect(ThreeXUi.get(t.id)?.config_transforms).toEqual([
    { tag: "Port443 XHTTP", port: 443 },
  ]);
  // explicit empty array clears them
  ThreeXUi.update(t.id, { config_transforms: [] });
  expect(ThreeXUi.get(t.id)?.config_transforms).toEqual([]);
});

test("sub_fetch_journal records and lists with user join", async () => {
  const u = Users.create({ username: "alice", token: "abc" });
  SubFetchJournal.record({
    user_id: u.id,
    attempted_token: "abc",
    ip: "10.0.0.1",
    user_agent: "v2raytun",
    headers: { "user-agent": "v2raytun" },
    status_code: 200,
    device_id: null,
    blocked_by: null,
  });
  SubFetchJournal.record({
    user_id: null,
    attempted_token: "nope",
    ip: null,
    user_agent: null,
    headers: {},
    status_code: 404,
    device_id: null,
    blocked_by: null,
  });
  const rows = SubFetchJournal.list({ limit: 100 });
  expect(rows).toHaveLength(2);
  expect(rows[0]!.status_code).toBe(404);
  expect(rows[0]!.user).toBeNull();
  expect(rows[1]!.user?.username).toBe("alice");
  expect(rows[1]!.headers["user-agent"]).toBe("v2raytun");
  // ON DELETE SET NULL: removing the user nulls out the FK but keeps the row
  Users.remove(u.id);
  const afterDelete = SubFetchJournal.list({ limit: 100 });
  expect(afterDelete).toHaveLength(2);
  expect(afterDelete.every((r) => r.user_id === null)).toBe(true);
});

test("sub_fetch_journal pruneOlderThan deletes rows past the retention window", async () => {
  const u = Users.create({ username: "alice", token: "abc" });
  // Insert one row with a timestamp older than 91 days
  db()
    .query(
      `
    INSERT INTO sub_fetch_journal (user_id, attempted_token, ip, user_agent, status_code, inserted_at)
    VALUES ($userId, 'old', '1.1.1.1', 'ua', 200, strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-91 days'))`,
    )
    .run({ userId: u.id });
  // And a fresh one
  SubFetchJournal.record({
    user_id: u.id,
    attempted_token: "new",
    ip: "1.1.1.1",
    user_agent: "ua",
    headers: {},
    status_code: 200,
    device_id: null,
    blocked_by: null,
  });
  const deleted = SubFetchJournal.pruneOlderThan(90);
  expect(deleted).toBe(1);
  const remaining = SubFetchJournal.list({ limit: 100 });
  expect(remaining).toHaveLength(1);
  expect(remaining[0]!.attempted_token).toBe("new");
});

test("sub_fetch_journal pruneOlderThan returns 0 when nothing matches", async () => {
  const u = Users.create({ username: "alice", token: "abc" });
  SubFetchJournal.record({
    user_id: u.id,
    attempted_token: "new",
    ip: null,
    user_agent: null,
    headers: {},
    status_code: 200,
    device_id: null,
    blocked_by: null,
  });
  expect(SubFetchJournal.pruneOlderThan(90)).toBe(0);
});

test("devices block/label/listBlocked round-trip", async () => {
  const u = Users.create({ username: "alice", token: "abc" });
  const d = Devices.upsertByHwid({
    user_id: u.id,
    hwid: "HW1",
    ua: "happ/1.0",
    ip: "10.0.0.1",
  });
  expect(d.is_blocked).toBe(false);
  expect(Devices.listBlocked({ limit: 100 })).toHaveLength(0);
  Devices.setBlocked(d.id, true);
  Devices.setLabel(d.id, "old phone");
  const blocked = Devices.listBlocked({ limit: 100 });
  expect(blocked).toHaveLength(1);
  expect(blocked[0]!.label).toBe("old phone");
  expect(blocked[0]!.user.username).toBe("alice");
  Devices.remove(d.id);
  expect(Devices.listForUser(u.id)).toHaveLength(0);
});

test("listBlocked paginates by keyset (id DESC, before_id)", async () => {
  const u = Users.create({ username: "alice", token: "abc" });
  for (let i = 1; i <= 3; i++) {
    const d = Devices.upsertByHwid({
      user_id: u.id,
      hwid: `HW${i}`,
      ua: null,
      ip: null,
    });
    Devices.setBlocked(d.id, true);
  }
  const page1 = Devices.listBlocked({ limit: 2 });
  expect(page1.map((d) => d.hwid)).toEqual(["HW3", "HW2"]);
  const page2 = Devices.listBlocked({
    limit: 2,
    beforeId: page1[page1.length - 1]!.id,
  });
  expect(page2.map((d) => d.hwid)).toEqual(["HW1"]);
});

test("ip_blocklist CRUD and duplicate rejection", async () => {
  const row = IpBlocklist.add({ cidr: "203.0.113.0/24", note: "abusers" });
  expect(row.id).toBeGreaterThan(0);
  expect(IpBlocklist.list()).toHaveLength(1);
  expect(() => IpBlocklist.add({ cidr: "203.0.113.0/24", note: null })).toThrow(
    /UNIQUE/,
  );
  // equivalent spellings are stored canonically, so they collide too
  IpBlocklist.add({ cidr: "2001:DB8:0::/32", note: null });
  expect(() => IpBlocklist.add({ cidr: "2001:db8::/32", note: null })).toThrow(
    /UNIQUE/,
  );
  expect(IpBlocklist.list().map((r) => r.cidr)).toEqual([
    "2001:db8::/32",
    "203.0.113.0/24",
  ]);
  expect(IpBlocklist.isBlocked("203.0.113.42")).toBe(true);
  expect(IpBlocklist.isBlocked("198.51.100.1")).toBe(false);
  IpBlocklist.remove(row.id);
  expect(IpBlocklist.list()).toHaveLength(1);
});
