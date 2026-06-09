// src/domain/blockCheck.ts
// Decide whether a subscription fetch must be denied: either the resolved
// device is blocked, or the client IP matches the global IP blocklist.
import { sql } from "../db/client";
import type { SQL } from "bun";
import * as IpBlocklist from "../db/ipBlocklist";
import type { DeviceRow } from "../db/devices";

export type BlockResult =
  | { blocked: false }
  | { blocked: true; by: "device" | "ip" };

export async function checkBlocked(
  args: { device: DeviceRow | null; ip: string | null },
  db: SQL = sql(),
): Promise<BlockResult> {
  if (args.device?.is_blocked) return { blocked: true, by: "device" };
  if (args.ip && (await ipIsBlocked(args.ip, db))) return { blocked: true, by: "ip" };
  return { blocked: false };
}

async function ipIsBlocked(ip: string, db: SQL): Promise<boolean> {
  try {
    return await IpBlocklist.isBlocked(ip, db);
  } catch (e) {
    // An unparseable IP string can't match any entry. clientIp() sanitizes
    // shape but not validity (e.g. "1.2.3.999" passes the regex).
    console.error("[block-check] ip check failed", e);
    return false;
  }
}
