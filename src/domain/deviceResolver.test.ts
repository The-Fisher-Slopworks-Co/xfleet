import { test, expect, beforeAll, beforeEach } from "bun:test";
import { __resetDbForTests, __truncateForTests } from "../db/client";
import { runMigrations } from "../db/migrate";
import * as Users from "../db/users";
import * as Devices from "../db/devices";
import { resolveDevice } from "./deviceResolver";

beforeAll(async () => {
  __resetDbForTests();
  await runMigrations();
});
beforeEach(() => {
  __truncateForTests();
});

const mkUser = () => Users.create({ username: "alice", token: "abc" });

test("hwid request creates a hwid-identified device", async () => {
  const u = await mkUser();
  const d = resolveDevice({
    userId: u.id,
    hwid: "HW1",
    userAgent: "v2raytun",
    ip: "203.0.113.7",
  });
  expect(d).not.toBeNull();
  expect(d!.hwid).toBe("HW1");
  expect(d!.fallback_ua).toBeNull();
  expect(d!.last_ip).toBe("203.0.113.7");
});

test("repeated hwid requests reuse the same device and bump last_seen_at", async () => {
  const u = await mkUser();
  const d1 = resolveDevice({
    userId: u.id,
    hwid: "HW1",
    userAgent: "v2raytun",
    ip: "203.0.113.7",
  });
  const d2 = resolveDevice({
    userId: u.id,
    hwid: "HW1",
    userAgent: "v2raytun/2",
    ip: "203.0.113.8",
  });
  expect(d2!.id).toBe(d1!.id);
  expect(d2!.last_ua).toBe("v2raytun/2");
  expect(d2!.last_ip).toBe("203.0.113.8");
  expect(Devices.listForUser(u.id)).toHaveLength(1);
});

test("no hwid with ua+ip creates a fallback device", async () => {
  const u = await mkUser();
  const d = resolveDevice({
    userId: u.id,
    hwid: null,
    userAgent: "happ/1.0",
    ip: "203.0.113.7",
  });
  expect(d!.hwid).toBeNull();
  expect(d!.fallback_ua).toBe("happ/1.0");
  expect(d!.fallback_ip).toBe("203.0.113.7");
  const again = resolveDevice({
    userId: u.id,
    hwid: null,
    userAgent: "happ/1.0",
    ip: "203.0.113.7",
  });
  expect(again!.id).toBe(d!.id);
  expect(Devices.listForUser(u.id)).toHaveLength(1);
});

test("same ua+ip for different users yields separate devices", async () => {
  const u1 = await mkUser();
  const u2 = Users.create({ username: "bob", token: "def" });
  const d1 = resolveDevice({
    userId: u1.id,
    hwid: null,
    userAgent: "happ/1.0",
    ip: "203.0.113.7",
  });
  const d2 = resolveDevice({
    userId: u2.id,
    hwid: null,
    userAgent: "happ/1.0",
    ip: "203.0.113.7",
  });
  expect(d1!.id).not.toBe(d2!.id);
});

test("hwid request supersedes an unblocked fallback device for the same ua+ip", async () => {
  const u = await mkUser();
  const fb = resolveDevice({
    userId: u.id,
    hwid: null,
    userAgent: "happ/1.0",
    ip: "203.0.113.7",
  });
  const hw = resolveDevice({
    userId: u.id,
    hwid: "HW1",
    userAgent: "happ/1.0",
    ip: "203.0.113.7",
  });
  expect(hw!.hwid).toBe("HW1");
  const remaining = Devices.listForUser(u.id);
  expect(remaining).toHaveLength(1);
  expect(remaining[0]!.id).toBe(hw!.id);
  expect(Devices.get(fb!.id)).toBeNull();
});

test("blocked fallback device is kept when hwid arrives", async () => {
  const u = await mkUser();
  const fb = resolveDevice({
    userId: u.id,
    hwid: null,
    userAgent: "happ/1.0",
    ip: "203.0.113.7",
  });
  Devices.setBlocked(fb!.id, true);
  resolveDevice({
    userId: u.id,
    hwid: "HW1",
    userAgent: "happ/1.0",
    ip: "203.0.113.7",
  });
  const remaining = Devices.listForUser(u.id);
  expect(remaining).toHaveLength(2);
  expect(Devices.get(fb!.id)!.is_blocked).toBe(true);
});

test("no hwid and no ip yields no device", async () => {
  const u = await mkUser();
  expect(
    resolveDevice({
      userId: u.id,
      hwid: null,
      userAgent: "happ/1.0",
      ip: null,
    }),
  ).toBeNull();
  expect(
    resolveDevice({
      userId: u.id,
      hwid: null,
      userAgent: null,
      ip: "203.0.113.7",
    }),
  ).toBeNull();
  expect(Devices.listForUser(u.id)).toHaveLength(0);
});
