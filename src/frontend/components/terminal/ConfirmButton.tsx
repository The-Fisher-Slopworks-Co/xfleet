// src/frontend/components/terminal/ConfirmButton.tsx
import { Button } from "@/components/ui/button";

export function ConfirmButton(props: {
  label: string;
  confirm?: string;
  variant?: "destructive" | "default" | "secondary";
  onConfirm: () => void | Promise<unknown>;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={props.variant ?? "destructive"}
      onClick={async () => {
        if (confirm(props.confirm ?? "are you sure?")) await props.onConfirm();
      }}
    >
      {props.label}
    </Button>
  );
}
