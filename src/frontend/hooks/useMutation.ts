// src/frontend/hooks/useMutation.ts
import { useState, useCallback } from "react";

export function useMutation<TArg, TRes>(
  fn: (arg: TArg) => Promise<TRes>,
  opts: { onSuccess?: (res: TRes) => void | Promise<void> } = {},
): {
  run: (arg: TArg) => Promise<TRes | null>;
  loading: boolean;
  fieldErrors: Record<string, string[]>;
  topError: string | null;
  reset: () => void;
} {
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [topError, setTopError] = useState<string | null>(null);

  const run = useCallback(async (arg: TArg) => {
    setLoading(true); setFieldErrors({}); setTopError(null);
    try {
      const r = await fn(arg);
      await opts.onSuccess?.(r);
      return r;
    } catch (e: any) {
      if (e?.body?.errors) setFieldErrors(e.body.errors);
      else setTopError(e?.body?.error ?? e?.message ?? "request failed");
      return null;
    } finally {
      setLoading(false);
    }
  }, [fn, opts]);

  const reset = useCallback(() => { setFieldErrors({}); setTopError(null); }, []);
  return { run, loading, fieldErrors, topError, reset };
}
