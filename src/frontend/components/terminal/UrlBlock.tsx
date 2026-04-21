import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export function UrlBlock({ url, className }: { url: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <button
      type="button"
      onClick={copy}
      title="copy"
      className={cn(
        "group w-full flex items-center gap-3 border border-dashed border-border bg-black/30",
        "px-3 py-2.5 text-left text-xs text-foreground break-all",
        "hover:border-primary hover:shadow-[0_0_12px_-2px_var(--primary)] transition-all cursor-pointer",
        className,
      )}
    >
      <span className="flex-1 select-all">{url}</span>
      <span className="shrink-0 flex items-center gap-1 text-primary text-[10px] uppercase tracking-wider opacity-60 group-hover:opacity-100">
        {copied ? <Check size={12} /> : <Copy size={12} />}
        {copied ? "copied" : "copy"}
      </span>
    </button>
  );
}
