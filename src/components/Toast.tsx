import { useEffect, useState } from "react";

let listener: ((msg: { text: string; kind: "ok" | "error" }) => void) | null = null;

export function toast(text: string, kind: "ok" | "error" = "ok") {
  listener?.({ text, kind });
}

export function ToastHost() {
  const [items, setItems] = useState<{ id: number; text: string; kind: "ok" | "error" }[]>([]);
  useEffect(() => {
    listener = (msg) => {
      const id = Date.now();
      setItems((s) => [...s, { id, ...msg }]);
      window.setTimeout(() => setItems((s) => s.filter((i) => i.id !== id)), 3200);
    };
    return () => {
      listener = null;
    };
  }, []);
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[80] space-y-2">
      {items.map((i) => (
        <div
          key={i.id}
          className={`pointer-events-auto rounded-xl border px-4 py-2 text-sm ${
            i.kind === "error"
              ? "border-danger/40 bg-danger/15 text-danger"
              : "border-accent/40 bg-zinc-900 text-foreground"
          }`}
        >
          {i.text}
        </div>
      ))}
    </div>
  );
}
