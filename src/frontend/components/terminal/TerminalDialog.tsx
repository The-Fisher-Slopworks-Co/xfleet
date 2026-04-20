// src/frontend/components/terminal/TerminalDialog.tsx
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function TerminalDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-background/80 z-40" />
        <Dialog.Content className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[min(640px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2",
          "border border-border bg-card p-6 shadow-[0_0_24px_-4px_var(--primary)]",
        )}>
          <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
            <Dialog.Title className="text-primary font-bold uppercase tracking-wider">
              ┌─ {props.title}
            </Dialog.Title>
            <Dialog.Close className="text-muted-foreground hover:text-primary">
              <X size={16} />
            </Dialog.Close>
          </div>
          {props.children}
          <div className="mt-6 text-muted-foreground text-xs">└{"─".repeat(60)}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
