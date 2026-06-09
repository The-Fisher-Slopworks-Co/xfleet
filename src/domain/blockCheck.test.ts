import { test, expect, beforeAll, beforeEach } from "bun:test";
import { __resetSqlForTests, sql } from "../db/client";
import { runMigrations } from "../db/migrate";
import * as Users from "../db/users";
import * as Devices from "../db/devices";
import * as IpBlocklist from "../db/ipBlocklist";
import { checkBlocked } from "./blockCheck";

const TEST_URL = process.env.TEST_DATABASE_URL;
if (!TEST_URL) {
  test.skip("blockCheck test skipped", () => {});
} else {
  beforeAll(async () => {
    __resetSqlForTests(TEST_URL);
    await runMigrations();
  });
  beforeEach(async () => {
    await sql()`TRUNCATE users, devices, ip_blocklist, sub_fetch_journal RESTART IDENTITY CASCADE`;
  });

  const mkDevice = async (blocked: boolean) => {
    const u = await Users.create({ username: "alice", token: "abc" });
    const d = await Devices.upsertByHwid({ user_id: u.id, hwid: "HW1", ua: null, ip: null });
    return blocked ? (await Devices.setBlocked(d.id, true))! : d;
  };

  test("nothing blocked", async () => {
    const d = await mkDevice(false);
    expect(await checkBlocked({ device: d, ip: "203.0.113.7" })).toEqual({ blocked: false });
    expect(await checkBlocked({ device: null, ip: null })).toEqual({ blocked: false });
  });

  test("blocked device wins", async () => {
    const d = await mkDevice(true);
    expect(await checkBlocked({ device: d, ip: "203.0.113.7" })).toEqual({ blocked: true, by: "device" });
  });

  test("exact IP match blocks", async () => {
    await IpBlocklist.add({ cidr: "203.0.113.7", note: null });
    expect(await checkBlocked({ device: null, ip: "203.0.113.7" })).toEqual({ blocked: true, by: "ip" });
    expect(await checkBlocked({ device: null, ip: "203.0.113.8" })).toEqual({ blocked: false });
  });

  test("CIDR range match blocks", async () => {
    await IpBlocklist.add({ cidr: "203.0.113.0/24", note: "abusers" });
    expect(await checkBlocked({ device: null, ip: "203.0.113.99" })).toEqual({ blocked: true, by: "ip" });
    expect(await checkBlocked({ device: null, ip: "203.0.114.1" })).toEqual({ blocked: false });
  });

  test("IPv6 containment works", async () => {
    await IpBlocklist.add({ cidr: "2001:db8::/32", note: null });
    expect(await checkBlocked({ device: null, ip: "2001:db8::1" })).toEqual({ blocked: true, by: "ip" });
    expect(await checkBlocked({ device: null, ip: "2001:db9::1" })).toEqual({ blocked: false });
  });
}
