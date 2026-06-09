import { test, expect, beforeAll, beforeEach } from "bun:test";
import { __resetSqlForTests, sql } from "../db/client";
import { runMigrations } from "../db/migrate";
import * as Users from "../db/users";
import * as Devices from "../db/devices";
import { resolveDevice } from "./deviceResolver";

const TEST_URL = process.env.TEST_DATABASE_URL;
if (!TEST_URL) {
  test.skip("deviceResolver test skipped", () => {});
} else {
  beforeAll(async () => {
    __resetSqlForTests(TEST_URL);
    await runMigrations();
  });
  beforeEach(async () => {
    await sql()`TRUNCATE users, devices, ip_blocklist, sub_fetch_journal RESTART IDENTITY CASCADE`;
  });

  const mkUser = () => Users.create({ username: "alice", token: "abc" });

  test("hwid request creates a hwid-identified device", async () => {
    const u = await mkUser();
    const d = await resolveDevice({ userId: u.id, hwid: "HW1", userAgent: "v2raytun", ip: "203.0.113.7" });
    expect(d).not.toBeNull();
    expect(d!.hwid).toBe("HW1");
    expect(d!.fallback_ua).toBeNull();
    expect(d!.last_ip).toBe("203.0.113.7");
  });

  test("repeated hwid requests reuse the same device and bump last_seen_at", async () => {
    const u = await mkUser();
    const d1 = await resolveDevice({ userId: u.id, hwid: "HW1", userAgent: "v2raytun", ip: "203.0.113.7" });
    const d2 = await resolveDevice({ userId: u.id, hwid: "HW1", userAgent: "v2raytun/2", ip: "203.0.113.8" });
    expect(d2!.id).toBe(d1!.id);
    expect(d2!.last_ua).toBe("v2raytun/2");
    expect(d2!.last_ip).toBe("203.0.113.8");
    expect(await Devices.listForUser(u.id)).toHaveLength(1);
  });

  test("no hwid with ua+ip creates a fallback device", async () => {
    const u = await mkUser();
    const d = await resolveDevice({ userId: u.id, hwid: null, userAgent: "happ/1.0", ip: "203.0.113.7" });
    expect(d!.hwid).toBeNull();
    expect(d!.fallback_ua).toBe("happ/1.0");
    expect(d!.fallback_ip).toBe("203.0.113.7");
    const again = await resolveDevice({ userId: u.id, hwid: null, userAgent: "happ/1.0", ip: "203.0.113.7" });
    expect(again!.id).toBe(d!.id);
    expect(await Devices.listForUser(u.id)).toHaveLength(1);
  });

  test("same ua+ip for different users yields separate devices", async () => {
    const u1 = await mkUser();
    const u2 = await Users.create({ username: "bob", token: "def" });
    const d1 = await resolveDevice({ userId: u1.id, hwid: null, userAgent: "happ/1.0", ip: "203.0.113.7" });
    const d2 = await resolveDevice({ userId: u2.id, hwid: null, userAgent: "happ/1.0", ip: "203.0.113.7" });
    expect(d1!.id).not.toBe(d2!.id);
  });

  test("hwid request supersedes an unblocked fallback device for the same ua+ip", async () => {
    const u = await mkUser();
    const fb = await resolveDevice({ userId: u.id, hwid: null, userAgent: "happ/1.0", ip: "203.0.113.7" });
    const hw = await resolveDevice({ userId: u.id, hwid: "HW1", userAgent: "happ/1.0", ip: "203.0.113.7" });
    expect(hw!.hwid).toBe("HW1");
    const remaining = await Devices.listForUser(u.id);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.id).toBe(hw!.id);
    expect(await Devices.get(fb!.id)).toBeNull();
  });

  test("blocked fallback device is kept when hwid arrives", async () => {
    const u = await mkUser();
    const fb = await resolveDevice({ userId: u.id, hwid: null, userAgent: "happ/1.0", ip: "203.0.113.7" });
    await Devices.setBlocked(fb!.id, true);
    await resolveDevice({ userId: u.id, hwid: "HW1", userAgent: "happ/1.0", ip: "203.0.113.7" });
    const remaining = await Devices.listForUser(u.id);
    expect(remaining).toHaveLength(2);
    expect((await Devices.get(fb!.id))!.is_blocked).toBe(true);
  });

  test("no hwid and no ip yields no device", async () => {
    const u = await mkUser();
    expect(await resolveDevice({ userId: u.id, hwid: null, userAgent: "happ/1.0", ip: null })).toBeNull();
    expect(await resolveDevice({ userId: u.id, hwid: null, userAgent: null, ip: "203.0.113.7" })).toBeNull();
    expect(await Devices.listForUser(u.id)).toHaveLength(0);
  });
}
