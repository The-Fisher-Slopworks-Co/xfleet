// src/frontend/components/terminal/Toasts.tsx
import { createContext, useContext, useState, useCallback } from "react";

type Toast = { id: number; text: string; kind: "info" | "error" };
const Ctx = createContext<{ toast: (text: string, kind?: "info" | "error") => void }>({ toast: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const toast = useCallback((text: string, kind: "info" | "error" = "info") => {
    const id = Date.now() + Math.random();
    setItems(prev => [...prev, { id, text, kind }]);
    setTimeout(() => setItems(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);
  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] space-y-2">
        {items.map(t => (
          <div key={t.id} className={
            "border px-3 py-2 bg-card text-sm " +
            (t.kind === "error" ? "border-destructive text-destructive" : "border-primary text-primary")
          }>
            {t.kind === "error" ? "! " : "> "}{t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx).toast;
