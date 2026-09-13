// src/shared/ip.test.ts
import { test, expect } from "bun:test";
import { cidrContains, formatCidr, parseCidr, parseIp } from "./ip";

const canon = (s: string) => {
  const c = parseCidr(s);
  return c ? formatCidr(c) : null;
};
const contains = (net: string, ip: string) => cidrContains(parseCidr(net)!, parseIp(ip)!);

test("canonicalizes IPv4 hosts and ranges", () => {
  expect(canon("203.0.113.7")).toBe("203.0.113.7");
  expect(canon("203.0.113.7/32")).toBe("203.0.113.7");
  expect(canon("203.0.113.0/24")).toBe("203.0.113.0/24");
  // host bits are kept, like Postgres inet
  expect(canon("203.0.113.5/24")).toBe("203.0.113.5/24");
  expect(canon("0.0.0.0/0")).toBe("0.0.0.0/0");
});

test("canonicalizes IPv6 per RFC 5952", () => {
  expect(canon("2001:DB8:0:0:0:0:0:1")).toBe("2001:db8::1");
  expect(canon("2001:db8::/32")).toBe("2001:db8::/32");
  expect(canon("2001:0db8:0000:0000:0001:0000:0000:0001")).toBe("2001:db8::1:0:0:1");
  expect(canon("2001:db8:0:1:1:1:1:1")).toBe("2001:db8:0:1:1:1:1:1");
  expect(canon("::")).toBe("::");
  expect(canon("::1/128")).toBe("::1");
  expect(canon("fe80::")).toBe("fe80::");
  expect(canon("::FFFF:192.0.2.1")).toBe("::ffff:192.0.2.1");
});

test("rejects malformed input", () => {
  for (const bad of [
    "", "1.2.3", "1.2.3.4.5", "1.2.3.999", "1.2.3.4/33", "1.2.3.4/", "1.2.3.4/-1", "a.b.c.d",
    "1::2::3", "12345::", ":::", "1:2:3:4:5:6:7", "1:2:3:4:5:6:7:8:9", "1:2:3:4:5:6:7:8::",
    "::/129", "fe80::1%eth0", "1.2.3.4::", " 1.2.3.4",
  ]) {
    expect(parseCidr(bad)).toBeNull();
  }
});

test("IPv4 containment", () => {
  expect(contains("203.0.113.7", "203.0.113.7")).toBe(true);
  expect(contains("203.0.113.7", "203.0.113.8")).toBe(false);
  expect(contains("203.0.113.0/24", "203.0.113.255")).toBe(true);
  expect(contains("203.0.113.0/24", "203.0.114.0")).toBe(false);
  expect(contains("10.0.0.0/9", "10.127.255.255")).toBe(true);
  expect(contains("10.0.0.0/9", "10.128.0.0")).toBe(false);
  expect(contains("0.0.0.0/0", "198.51.100.1")).toBe(true);
});

test("IPv6 containment", () => {
  expect(contains("2001:db8::/32", "2001:db8:ffff::1")).toBe(true);
  expect(contains("2001:db8::/32", "2001:db9::1")).toBe(false);
  expect(contains("2001:db8::1", "2001:0db8::0001")).toBe(true);
});

test("families never match each other", () => {
  expect(contains("0.0.0.0/0", "::ffff:1.2.3.4")).toBe(false);
  expect(contains("::/0", "1.2.3.4")).toBe(false);
});
