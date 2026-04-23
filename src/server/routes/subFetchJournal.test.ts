import { test, expect, beforeAll, beforeEach } from "bun:test";
import { __resetSqlForTests, sql } from "../../db/client";
import { runMigrations } from "../../db/migrate";
import * as Users from "../../db/users";
import * as SubFetchJournal from "../../db/subFetchJournal";
import { subFetchJournalRoutes } from "./subFetchJournal";
import { issueSession } from "../session";
import type { Env } from "../env";

const TEST_URL = process.env.TEST_DATABASE_URL;
if (!TEST_URL) {
  test.skip("sub-journal route test skipped", () => {});
} else {
  const env = {
    profileTitle: "VPN", adminUsername: "admin", adminPasswordHash: "",
    sessionSecret: "x".repeat(64), masterKey: "", databaseUrl: "", port: 0,
    publicBaseUrl: "https://vpn.example.com", trustProxy: false, subJournalRetentionDays: 90,
  } satisfies Env;

  const authCookie = () =>
    `xfleet_session=${issueSession("admin", env.sessionSecret).value}`;

  beforeAll(async () => {
    __resetSqlForTests(TEST_URL);
    await runMigrations();
  });
  beforeEach(async () => {
    const db = sql();
    await db`TRUNCATE users, servers, configs, three_x_ui_servers,
             ext_sub_sources, ext_sub_links, ext_sub_user_sources,
             sub_fetch_journal RESTART IDENTITY CASCADE`;
  });

  async function seed() {
    const alice = await Users.create({ username: "alice", token: "a" });
    const bob = await Users.create({ username: "bob", token: "b" });
    // 5 alice rows, then 3 bob rows (bob newest)
    for (let i = 0; i < 5; i++) {
      await SubFetchJournal.record({
        user_id: alice.id, attempted_token: "a", ip: "1.1.1.1",
        user_agent: "v2raytun", headers: { "user-agent": "v2raytun" }, status_code: 200,
      });
    }
    for (let i = 0; i < 3; i++) {
      await SubFetchJournal.record({
        user_id: bob.id, attempted_token: "b", ip: "2.2.2.2",
        user_agent: "hiddify", headers: { "user-agent": "hiddify" }, status_code: 200,
      });
    }
    return { alice, bob };
  }

  test("GET /api/admin/sub-journal requires auth", async () => {
    const routes = subFetchJournalRoutes(env);
    const res = await routes["/api/admin/sub-journal"].GET(
      new Request("http://x/api/admin/sub-journal"),
    );
    expect(res.status).toBe(401);
  });

  test("GET /api/admin/sub-journal returns all rows newest-first", async () => {
    await seed();
    const routes = subFetchJournalRoutes(env);
    const res = await routes["/api/admin/sub-journal"].GET(
      new Request("http://x/api/admin/sub-journal", { headers: { cookie: authCookie() } }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(8);
    expect(body[0].user.username).toBe("bob");
    expect(body[body.length - 1].user.username).toBe("alice");
    // newest-first: ids strictly decreasing
    for (let i = 1; i < body.length; i++) {
      expect(body[i - 1].id).toBeGreaterThan(body[i].id);
    }
  });

  test("GET /api/admin/sub-journal?user_id=N filters by user", async () => {
    const { alice } = await seed();
    const routes = subFetchJournalRoutes(env);
    const res = await routes["/api/admin/sub-journal"].GET(
      new Request(`http://x/api/admin/sub-journal?user_id=${alice.id}`, {
        headers: { cookie: authCookie() },
      }),
    );
    const body = await res.json();
    expect(body).toHaveLength(5);
    expect(body.every((r: any) => r.user.username === "alice")).toBe(true);
  });

  test("GET /api/admin/sub-journal supports keyset pagination via before_id", async () => {
    await seed();
    const routes = subFetchJournalRoutes(env);
    const first = await routes["/api/admin/sub-journal"].GET(
      new Request("http://x/api/admin/sub-journal?limit=3", { headers: { cookie: authCookie() } }),
    );
    const firstBody = await first.json();
    expect(firstBody).toHaveLength(3);
    const before = firstBody[firstBody.length - 1].id;
    const second = await routes["/api/admin/sub-journal"].GET(
      new Request(`http://x/api/admin/sub-journal?limit=3&before_id=${before}`, {
        headers: { cookie: authCookie() },
      }),
    );
    const secondBody = await second.json();
    expect(secondBody).toHaveLength(3);
    // No overlap and still ordered DESC
    expect(secondBody[0].id).toBeLessThan(before);
  });

  test("GET /api/admin/users/:id/sub-journal returns rows only for that user", async () => {
    const { bob } = await seed();
    const routes = subFetchJournalRoutes(env);
    const res = await routes["/api/admin/users/:id/sub-journal"].GET(
      Object.assign(
        new Request(`http://x/api/admin/users/${bob.id}/sub-journal`, {
          headers: { cookie: authCookie() },
        }),
        { params: { id: String(bob.id) } },
      ),
    );
    const body = await res.json();
    expect(body).toHaveLength(3);
    expect(body.every((r: any) => r.user.username === "bob")).toBe(true);
  });

  test("limit is clamped to 1000 max", async () => {
    const routes = subFetchJournalRoutes(env);
    const res = await routes["/api/admin/sub-journal"].GET(
      new Request("http://x/api/admin/sub-journal?limit=99999", {
        headers: { cookie: authCookie() },
      }),
    );
    expect(res.status).toBe(200);
  });
}
