import { cn } from "@/lib/utils";

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-block border border-border px-1.5 py-0 text-xs text-foreground bg-black/30 font-mono",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
