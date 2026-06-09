// src/frontend/components/terminal/DeviceIdentity.tsx
import { truncateText } from "@/lib/utils";
import { Badge } from "./Badge";

export function DeviceIdentity(props: {
  device: { hwid: string | null; fallback_ua: string | null; fallback_ip: string | null };
}) {
  const d = props.device;
  if (d.hwid) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Badge variant="ok">hwid</Badge>
        <code className="text-xs break-all">{truncateText(d.hwid, 28)}</code>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge variant="muted">ua+ip</Badge>
      <span className="text-xs break-all">{truncateText(d.fallback_ua, 40)} @ {d.fallback_ip ?? "—"}</span>
    </span>
  );
}
