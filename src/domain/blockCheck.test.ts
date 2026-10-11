import { test, expect, beforeAll, beforeEach } from "bun:test";
import { __resetDbForTests, __truncateForTests } from "../db/client";
import { runMigrations } from "../db/migrate";
import * as Users from "../db/users";
import * as Devices from "../db/devices";
import * as IpBlocklist from "../db/ipBlocklist";
import { checkBlocked } from "./blockCheck";

beforeAll(async () => {
  __resetDbForTests();
  await runMigrations();
});
beforeEach(() => {
  __truncateForTests();
});

const mkDevice = async (blocked: boolean) => {
  const u = Users.create({ username: "alice", token: "abc" });
  const d = Devices.upsertByHwid({
    user_id: u.id,
    hwid: "HW1",
    ua: null,
    ip: null,
  });
  return blocked ? Devices.setBlocked(d.id, true)! : d;
};

test("nothing blocked", async () => {
  const d = await mkDevice(false);
  expect(checkBlocked({ device: d, ip: "203.0.113.7" })).toEqual({
    blocked: false,
  });
  expect(checkBlocked({ device: null, ip: null })).toEqual({ blocked: false });
});

test("blocked device wins", async () => {
  const d = await mkDevice(true);
  expect(checkBlocked({ device: d, ip: "203.0.113.7" })).toEqual({
    blocked: true,
    by: "device",
  });
});

test("exact IP match blocks", async () => {
  IpBlocklist.add({ cidr: "203.0.113.7", note: null });
  expect(checkBlocked({ device: null, ip: "203.0.113.7" })).toEqual({
    blocked: true,
    by: "ip",
  });
  expect(checkBlocked({ device: null, ip: "203.0.113.8" })).toEqual({
    blocked: false,
  });
});

test("CIDR range match blocks", async () => {
  IpBlocklist.add({ cidr: "203.0.113.0/24", note: "abusers" });
  expect(checkBlocked({ device: null, ip: "203.0.113.99" })).toEqual({
    blocked: true,
    by: "ip",
  });
  expect(checkBlocked({ device: null, ip: "203.0.114.1" })).toEqual({
    blocked: false,
  });
});

test("IPv6 containment works", async () => {
  IpBlocklist.add({ cidr: "2001:db8::/32", note: null });
  expect(checkBlocked({ device: null, ip: "2001:db8::1" })).toEqual({
    blocked: true,
    by: "ip",
  });
  expect(checkBlocked({ device: null, ip: "2001:db9::1" })).toEqual({
    blocked: false,
  });
});
