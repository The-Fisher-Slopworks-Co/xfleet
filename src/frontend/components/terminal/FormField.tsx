// src/frontend/components/terminal/FormField.tsx
import { cn } from "@/lib/utils";

export function FormField(props: {
  label: string;
  error?: string[];
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block mb-4">
      <span className="block text-xs uppercase tracking-wider text-primary mb-1">
        {props.label}{props.required && <span className="text-destructive ml-1">*</span>}
      </span>
      {props.children}
      {props.error && props.error.length > 0 && (
        <span className={cn("block mt-1 text-xs text-destructive")}>
          ! {props.error.join(", ")}
        </span>
      )}
    </label>
  );
}
