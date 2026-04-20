// src/frontend/components/terminal/Badge.tsx
import { cn } from "@/lib/utils";

export function Badge(props: { variant?: "ok" | "err" | "warn" | "muted"; children: React.ReactNode }) {
  const cls = {
    ok: "border-primary text-primary",
    err: "border-destructive text-destructive",
    warn: "border-yellow-400 text-yellow-400",
    muted: "border-muted-foreground text-muted-foreground",
  }[props.variant ?? "muted"];
  return (
    <span className={cn("inline-block border px-1.5 py-0 text-[10px] uppercase tracking-wider", cls)}>
      {props.children}
    </span>
  );
}
