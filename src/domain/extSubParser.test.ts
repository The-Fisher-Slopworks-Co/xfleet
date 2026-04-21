import { test, expect } from "bun:test";
import { parseSubBody } from "./extSubParser";

test("parses plaintext newline-delimited URIs", () => {
  const body = "vless://abc@h:443?type=tcp\nvmess://xyz@h:80";
  expect(parseSubBody(body)).toEqual([
    { uri: "vless://abc@h:443?type=tcp", label: null },
    { uri: "vmess://xyz@h:80", label: null },
  ]);
});

test("strips #fragment into label with URL-decoding", () => {
  const body = "vless://abc@h:443#HK%2001%20premium";
  expect(parseSubBody(body)).toEqual([{ uri: "vless://abc@h:443", label: "HK 01 premium" }]);
});

test("handles \\r\\n line endings", () => {
  const body = "vless://a\r\nvless://b\r\n";
  expect(parseSubBody(body)).toEqual([
    { uri: "vless://a", label: null },
    { uri: "vless://b", label: null },
  ]);
});

test("skips empty and whitespace-only lines", () => {
  const body = "\nvless://a\n  \nvless://b\n";
  expect(parseSubBody(body)).toEqual([
    { uri: "vless://a", label: null },
    { uri: "vless://b", label: null },
  ]);
});

test("skips lines without ://", () => {
  const body = "vless://a\nnot-a-uri\nvless://b";
  expect(parseSubBody(body)).toEqual([
    { uri: "vless://a", label: null },
    { uri: "vless://b", label: null },
  ]);
});

test("decodes base64 blob", () => {
  const inner = "vless://abc@h:443#HK-01\nvmess://xyz@h:80";
  const b64 = Buffer.from(inner).toString("base64");
  expect(parseSubBody(b64)).toEqual([
    { uri: "vless://abc@h:443", label: "HK-01" },
    { uri: "vmess://xyz@h:80", label: null },
  ]);
});

test("does not double-decode plaintext that happens to match base64 character set", () => {
  // Plaintext URIs contain "://" which disqualifies base64 detection
  const body = "vless://abc";
  expect(parseSubBody(body)).toEqual([{ uri: "vless://abc", label: null }]);
});

test("falls back to raw when base64-shaped input decodes to garbage", () => {
  // valid base64 but decoded bytes don't include "://"
  const garbage = Buffer.from("hello world").toString("base64");
  expect(parseSubBody(garbage)).toEqual([]);
});

test("empty label (trailing #) yields null", () => {
  const body = "vless://abc#";
  expect(parseSubBody(body)).toEqual([{ uri: "vless://abc", label: null }]);
});

test("whitespace-only label after decode yields null", () => {
  const body = "vless://abc#%20%20";
  expect(parseSubBody(body)).toEqual([{ uri: "vless://abc", label: null }]);
});

test("malformed URL-encoding in label falls back to raw", () => {
  const body = "vless://abc#%E0bad";
  const parsed = parseSubBody(body);
  expect(parsed).toHaveLength(1);
  expect(parsed[0]!.uri).toBe("vless://abc");
  expect(parsed[0]!.label).toBe("%E0bad");
});
