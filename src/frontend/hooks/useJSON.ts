// src/frontend/hooks/useJSON.ts
import { useEffect, useState, useCallback } from "react";
import { api } from "../lib/api";

export function useJSON<T>(url: string | null): {
  data: T | null; error: any; loading: boolean; refetch: () => Promise<void>;
} {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!url) return;
    setLoading(true); setError(null);
    try {
      const r = await api.get<T>(url);
      setData(r);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => { void refetch(); }, [refetch]);
  return { data, error, loading, refetch };
}
