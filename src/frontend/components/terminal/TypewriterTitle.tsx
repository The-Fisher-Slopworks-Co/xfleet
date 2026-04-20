// src/frontend/components/terminal/TypewriterTitle.tsx
import { useEffect, useState } from "react";

export function TypewriterTitle(props: { text: string; className?: string }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    setShown(0);
    let i = 0;
    const t = setInterval(() => {
      i++;
      setShown(i);
      if (i >= props.text.length) clearInterval(t);
    }, 24);
    return () => clearInterval(t);
  }, [props.text]);
  const done = shown >= props.text.length;
  return (
    <h1 className={"text-2xl font-bold text-primary " + (props.className ?? "")}>
      <span>{props.text.slice(0, shown)}</span>
      <span className={done ? "caret" : ""} />
    </h1>
  );
}
