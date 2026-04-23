// src/frontend/components/terminal/JournalStatusBadge.tsx
import { Badge } from "./Badge";

export function JournalStatusBadge({ code }: { code: number }) {
  if (code === 200) return <Badge variant="ok">{code} ok</Badge>;
  if (code === 302) return <Badge variant="warn">{code} browser</Badge>;
  if (code === 404) return <Badge variant="err">{code} unknown</Badge>;
  return <Badge variant="muted">{code}</Badge>;
}
