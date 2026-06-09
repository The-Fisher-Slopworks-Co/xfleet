import { test, expect, beforeAll, beforeEach } from "bun:test";
import { __resetSqlForTests, sql } from "../../db/client";
import { runMigrations } from "../../db/migrate";
import * as Users from "../../db/users";
import * as Servers from "../../db/servers";
import * as Configs from "../../db/configs";
import * as ExtSubSources from "../../db/extSubSources";
import * as ExtSubLinks from "../../db/extSubLinks";
import * as ExtSubAssignments from "../../db/extSubAssignments";
import * as SubFetchJournal from "../../db/subFetchJournal";
import * as Devices from "../../db/devices";
import * as IpBlocklist from "../../db/ipBlocklist";
import { subscriptionRoutes } from "./subscription";
import type { Env } from "../env";
import type { SseHub, SyncEvent } from "../sseHub";

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
             ext_sub_sources, ext_sub_links, ext_sub_user_sources,
             sub_fetch_journal, devices, ip_blocklist RESTART IDENTITY CASCADE`;
  });

  const env = {
    profileTitle: "VPN", adminUsername: "", adminPasswordHash: "", sessionSecret: "",
    masterKey: "", databaseUrl: "", port: 0, publicBaseUrl: "https://vpn.example.com",
    trustProxy: false, subJournalRetentionDays: 90,
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

  test("browser user-agent redirects to the SPA install page", async () => {
    await Users.create({ username: "alice", token: "abc" });
    const routes = subscriptionRoutes(env);
    const res = await routes["/sub/:token"].GET(
      Object.assign(
        new Request("http://x/sub/abc", {
          headers: { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15" },
        }),
        { params: { token: "abc" } },
      ),
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/install/abc");
  });

  test("public sub api returns username and canonical URL", async () => {
    await Users.create({ username: "alice", token: "abc" });
    const routes = subscriptionRoutes(env);
    const res = await routes["/api/public/sub/:token"].GET(
      Object.assign(new Request("http://x/api/public/sub/abc"), { params: { token: "abc" } }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ username: "alice", subUrl: "https://vpn.example.com/sub/abc" });
  });

  test("public sub api returns 404 for unknown token", async () => {
    const routes = subscriptionRoutes(env);
    const res = await routes["/api/public/sub/:token"].GET(
      Object.assign(new Request("http://x/api/public/sub/nope"), { params: { token: "nope" } }),
    );
    expect(res.status).toBe(404);
  });

  test("non-browser user-agent returns plain-text subscription", async () => {
    const u = await Users.create({ username: "alice", token: "abc" });
    const s = await Servers.create({ name: "eu" });
    await Configs.create({ user_id: u.id, server_id: s.id, config: "vless://x", tag: null });
    const routes = subscriptionRoutes(env);
    const res = await routes["/sub/:token"].GET(
      Object.assign(
        new Request("http://x/sub/abc", { headers: { "user-agent": "v2raytun/android" } }),
        { params: { token: "abc" } },
      ),
    );
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(await res.text()).toBe("vless://x#eu");
  });

  test("missing user-agent returns plain-text subscription", async () => {
    const u = await Users.create({ username: "alice", token: "abc" });
    const s = await Servers.create({ name: "eu" });
    await Configs.create({ user_id: u.id, server_id: s.id, config: "vless://x", tag: null });
    const routes = subscriptionRoutes(env);
    const res = await routes["/sub/:token"].GET(
      Object.assign(new Request("http://x/sub/abc"), { params: { token: "abc" } }),
    );
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(await res.text()).toBe("vless://x#eu");
  });

  test("browser user-agent on unknown token still returns 404", async () => {
    const routes = subscriptionRoutes(env);
    const res = await routes["/sub/:token"].GET(
      Object.assign(
        new Request("http://x/sub/nope", { headers: { "user-agent": "Mozilla/5.0" } }),
        { params: { token: "nope" } },
      ),
    );
    expect(res.status).toBe(404);
  });

  test("records a journal row on successful fetch with headers and UA", async () => {
    await Users.create({ username: "alice", token: "abc" });
    const routes = subscriptionRoutes(env);
    await routes["/sub/:token"].GET(
      Object.assign(
        new Request("http://x/sub/abc", {
          headers: { "user-agent": "v2raytun/ios 1.2", "x-device-model": "iPhone15,2", cookie: "secret=1" },
        }),
        { params: { token: "abc" } },
      ),
    );
    const entries = await SubFetchJournal.list({ limit: 10 });
    expect(entries).toHaveLength(1);
    const row = entries[0]!;
    expect(row.status_code).toBe(200);
    expect(row.user?.username).toBe("alice");
    expect(row.attempted_token).toBe("abc");
    expect(row.user_agent).toBe("v2raytun/ios 1.2");
    expect(row.headers["user-agent"]).toBe("v2raytun/ios 1.2");
    expect(row.headers["x-device-model"]).toBe("iPhone15,2");
    expect(row.headers["cookie"]).toBeUndefined();
  });

  test("records a 404 journal row with null user_id on unknown token", async () => {
    const routes = subscriptionRoutes(env);
    await routes["/sub/:token"].GET(
      Object.assign(new Request("http://x/sub/nope"), { params: { token: "nope" } }),
    );
    const entries = await SubFetchJournal.list({ limit: 10 });
    expect(entries).toHaveLength(1);
    expect(entries[0]!.status_code).toBe(404);
    expect(entries[0]!.user_id).toBeNull();
    expect(entries[0]!.attempted_token).toBe("nope");
  });

  test("records a 302 journal row on browser redirect", async () => {
    await Users.create({ username: "alice", token: "abc" });
    const routes = subscriptionRoutes(env);
    await routes["/sub/:token"].GET(
      Object.assign(
        new Request("http://x/sub/abc", { headers: { "user-agent": "Mozilla/5.0" } }),
        { params: { token: "abc" } },
      ),
    );
    const entries = await SubFetchJournal.list({ limit: 10 });
    expect(entries).toHaveLength(1);
    expect(entries[0]!.status_code).toBe(302);
    expect(entries[0]!.user?.username).toBe("alice");
  });

  test("uses X-Forwarded-For when TRUST_PROXY is enabled", async () => {
    await Users.create({ username: "alice", token: "abc" });
    const routes = subscriptionRoutes({ ...env, trustProxy: true });
    await routes["/sub/:token"].GET(
      Object.assign(
        new Request("http://x/sub/abc", {
          headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
        }),
        { params: { token: "abc" } },
      ),
    );
    const entries = await SubFetchJournal.list({ limit: 10 });
    expect(entries[0]!.ip).toBe("203.0.113.7");
  });

  test("ignores X-Forwarded-For when TRUST_PROXY is disabled", async () => {
    await Users.create({ username: "alice", token: "abc" });
    const routes = subscriptionRoutes(env);
    await routes["/sub/:token"].GET(
      Object.assign(
        new Request("http://x/sub/abc", {
          headers: { "x-forwarded-for": "203.0.113.7" },
        }),
        { params: { token: "abc" } },
      ),
    );
    const entries = await SubFetchJournal.list({ limit: 10 });
    expect(entries[0]!.ip).toBeNull();
  });

  test("broadcasts a sub_fetch event with the inserted row after journaling", async () => {
    const u = await Users.create({ username: "alice", token: "abc" });
    const events: SyncEvent[] = [];
    const fakeHub: SseHub = {
      broadcast: e => { events.push(e); },
      subscribe: () => ({ readable: new ReadableStream(), close: () => {} }),
      subscriberCount: () => 0,
    };
    const routes = subscriptionRoutes(env, fakeHub);
    await routes["/sub/:token"].GET(
      Object.assign(
        new Request("http://x/sub/abc", { headers: { "user-agent": "v2raytun" } }),
        { params: { token: "abc" } },
      ),
    );
    expect(events).toHaveLength(1);
    const e = events[0]!;
    expect(e.type).toBe("sub_fetch");
    if (e.type !== "sub_fetch") throw new Error("unreachable");
    expect(e.row.status_code).toBe(200);
    expect(e.row.user?.username).toBe("alice");
    expect(e.row.user_id).toBe(u.id);
    expect(typeof e.row.inserted_at).toBe("string");
    expect(e.row.id).toBeGreaterThan(0);
  });

  test("x-hwid fetch registers a hwid device and links the journal row", async () => {
    const u = await Users.create({ username: "alice", token: "abc" });
    const routes = subscriptionRoutes({ ...env, trustProxy: true });
    const res = await routes["/sub/:token"].GET(
      Object.assign(
        new Request("http://x/sub/abc", {
          headers: { "user-agent": "happ/1.0", "x-hwid": "HW1", "x-forwarded-for": "203.0.113.7" },
        }),
        { params: { token: "abc" } },
      ),
    );
    expect(res.status).toBe(200);
    const devices = await Devices.listForUser(u.id);
    expect(devices).toHaveLength(1);
    expect(devices[0]!.hwid).toBe("HW1");
    expect(devices[0]!.last_ip).toBe("203.0.113.7");
    const entries = await SubFetchJournal.list({ limit: 10 });
    expect(entries[0]!.device_id).toBe(devices[0]!.id);
    expect(entries[0]!.blocked_by).toBeNull();
  });

  test("repeat hwid fetches reuse the same device", async () => {
    const u = await Users.create({ username: "alice", token: "abc" });
    const routes = subscriptionRoutes(env);
    const fetchOnce = () => routes["/sub/:token"].GET(
      Object.assign(
        new Request("http://x/sub/abc", { headers: { "user-agent": "happ/1.0", "x-hwid": "HW1" } }),
        { params: { token: "abc" } },
      ),
    );
    await fetchOnce();
    await fetchOnce();
    expect(await Devices.listForUser(u.id)).toHaveLength(1);
  });

  test("fetch without hwid registers a fallback device from ua+ip", async () => {
    const u = await Users.create({ username: "alice", token: "abc" });
    const routes = subscriptionRoutes({ ...env, trustProxy: true });
    await routes["/sub/:token"].GET(
      Object.assign(
        new Request("http://x/sub/abc", {
          headers: { "user-agent": "v2raytun/android", "x-forwarded-for": "203.0.113.7" },
        }),
        { params: { token: "abc" } },
      ),
    );
    const devices = await Devices.listForUser(u.id);
    expect(devices).toHaveLength(1);
    expect(devices[0]!.hwid).toBeNull();
    expect(devices[0]!.fallback_ua).toBe("v2raytun/android");
    expect(devices[0]!.fallback_ip).toBe("203.0.113.7");
  });

  test("fetch without hwid and without ip does not register a device", async () => {
    const u = await Users.create({ username: "alice", token: "abc" });
    const routes = subscriptionRoutes(env);
    await routes["/sub/:token"].GET(
      Object.assign(
        new Request("http://x/sub/abc", { headers: { "user-agent": "v2raytun/android" } }),
        { params: { token: "abc" } },
      ),
    );
    expect(await Devices.listForUser(u.id)).toHaveLength(0);
  });

  test("blocked device gets a stealth 404 and the journal records blocked_by=device", async () => {
    const u = await Users.create({ username: "alice", token: "abc" });
    const s = await Servers.create({ name: "eu" });
    await Configs.create({ user_id: u.id, server_id: s.id, config: "vless://x", tag: null });
    const routes = subscriptionRoutes(env);
    const fetchOnce = () => routes["/sub/:token"].GET(
      Object.assign(
        new Request("http://x/sub/abc", { headers: { "user-agent": "happ/1.0", "x-hwid": "HW1" } }),
        { params: { token: "abc" } },
      ),
    );
    await fetchOnce();
    const device = (await Devices.listForUser(u.id))[0]!;
    await Devices.setBlocked(device.id, true);

    const res = await fetchOnce();
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("");
    const entries = await SubFetchJournal.list({ limit: 10 });
    expect(entries[0]!.status_code).toBe(404);
    expect(entries[0]!.blocked_by).toBe("device");
    expect(entries[0]!.device_id).toBe(device.id);
  });

  test("blocked device with a browser UA gets 404, not the install redirect", async () => {
    const u = await Users.create({ username: "alice", token: "abc" });
    const routes = subscriptionRoutes({ ...env, trustProxy: true });
    const fetchOnce = () => routes["/sub/:token"].GET(
      Object.assign(
        new Request("http://x/sub/abc", {
          headers: { "user-agent": "Mozilla/5.0", "x-forwarded-for": "203.0.113.7" },
        }),
        { params: { token: "abc" } },
      ),
    );
    await fetchOnce();
    const device = (await Devices.listForUser(u.id))[0]!;
    await Devices.setBlocked(device.id, true);
    const res = await fetchOnce();
    expect(res.status).toBe(404);
  });

  test("blocked IP gets a stealth 404 with blocked_by=ip; the device is still tracked", async () => {
    const u = await Users.create({ username: "alice", token: "abc" });
    await IpBlocklist.add({ cidr: "203.0.113.0/24", note: null });
    const routes = subscriptionRoutes({ ...env, trustProxy: true });
    const res = await routes["/sub/:token"].GET(
      Object.assign(
        new Request("http://x/sub/abc", {
          headers: { "user-agent": "happ/1.0", "x-hwid": "HW1", "x-forwarded-for": "203.0.113.77" },
        }),
        { params: { token: "abc" } },
      ),
    );
    expect(res.status).toBe(404);
    const entries = await SubFetchJournal.list({ limit: 10 });
    expect(entries[0]!.blocked_by).toBe("ip");
    expect(await Devices.listForUser(u.id)).toHaveLength(1);
  });

  test("IP outside a blocked CIDR is served normally", async () => {
    const u = await Users.create({ username: "alice", token: "abc" });
    const s = await Servers.create({ name: "eu" });
    await Configs.create({ user_id: u.id, server_id: s.id, config: "vless://x", tag: null });
    await IpBlocklist.add({ cidr: "203.0.113.0/24", note: null });
    const routes = subscriptionRoutes({ ...env, trustProxy: true });
    const res = await routes["/sub/:token"].GET(
      Object.assign(
        new Request("http://x/sub/abc", {
          headers: { "user-agent": "happ/1.0", "x-forwarded-for": "198.51.100.7" },
        }),
        { params: { token: "abc" } },
      ),
    );
    expect(res.status).toBe(200);
  });

  test("sub_fetch SSE event carries device_id and blocked_by", async () => {
    const u = await Users.create({ username: "alice", token: "abc" });
    const events: SyncEvent[] = [];
    const fakeHub: SseHub = {
      broadcast: e => { events.push(e); },
      subscribe: () => ({ readable: new ReadableStream(), close: () => {} }),
      subscriberCount: () => 0,
    };
    const routes = subscriptionRoutes(env, fakeHub);
    await routes["/sub/:token"].GET(
      Object.assign(
        new Request("http://x/sub/abc", { headers: { "user-agent": "happ/1.0", "x-hwid": "HW1" } }),
        { params: { token: "abc" } },
      ),
    );
    const device = (await Devices.listForUser(u.id))[0]!;
    const e = events[0]!;
    if (e.type !== "sub_fetch") throw new Error("unreachable");
    expect(e.row.device_id).toBe(device.id);
    expect(e.row.blocked_by).toBeNull();
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
