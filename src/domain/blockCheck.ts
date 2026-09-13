// src/domain/blockCheck.ts
// Decide whether a subscription fetch must be denied: either the resolved
// device is blocked, or the client IP matches the global IP blocklist.
import * as IpBlocklist from "../db/ipBlocklist";
import type { DeviceRow } from "../db/devices";

export type BlockResult =
  | { blocked: false }
  | { blocked: true; by: "device" | "ip" };

export function checkBlocked(args: { device: DeviceRow | null; ip: string | null }): BlockResult {
  if (args.device?.is_blocked) return { blocked: true, by: "device" };
  // clientIp() sanitizes shape but not validity (e.g. "1.2.3.999" passes);
  // isBlocked treats an unparseable IP as matching nothing.
  if (args.ip && IpBlocklist.isBlocked(args.ip)) return { blocked: true, by: "ip" };
  return { blocked: false };
}
