// src/frontend/components/terminal/CopyButton.tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";

export function CopyButton(props: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(props.text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      <span className="ml-1">{copied ? "copied" : (props.label ?? "copy")}</span>
    </Button>
  );
}
