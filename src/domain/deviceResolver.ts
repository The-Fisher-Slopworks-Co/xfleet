// src/domain/deviceResolver.ts
// Find-or-create the device record for a subscription fetch.
//
// Identity rules:
//  - x-hwid header present  → device keyed by (user_id, hwid)
//  - no hwid, ua + ip known → device keyed by (user_id, user_agent, ip)
//  - neither                → unidentifiable, no device record
//
// Promotion: when a hwid request arrives from a (ua, ip) pair that was
// previously tracked as a fallback device, the fallback row is superseded
// and deleted — unless it is blocked. A blocked fallback row is kept so
// requests from that ua+ip without a hwid still hit the block.
import { sql } from "../db/client";
import type { SQL } from "bun";
import * as Devices from "../db/devices";
import type { DeviceRow } from "../db/devices";

export type DeviceSignals = {
  userId: number;
  hwid: string | null;
  userAgent: string | null;
  ip: string | null;
};

export async function resolveDevice(signals: DeviceSignals, db: SQL = sql()): Promise<DeviceRow | null> {
  const { userId, hwid, userAgent, ip } = signals;

  if (hwid) {
    const device = await Devices.upsertByHwid({ user_id: userId, hwid, ua: userAgent, ip }, db);
    if (userAgent !== null && ip !== null) {
      const superseded = await Devices.findByFallback({ user_id: userId, ua: userAgent, ip }, db);
      if (superseded && !superseded.is_blocked) await Devices.remove(superseded.id, db);
    }
    return device;
  }

  if (userAgent !== null && ip !== null) {
    return Devices.upsertByFallback({ user_id: userId, ua: userAgent, ip }, db);
  }

  return null;
}
