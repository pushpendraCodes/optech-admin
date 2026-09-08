import { useEffect } from "react";

export function Drawer({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button className="absolute inset-0 bg-[#06060e]/70 backdrop-blur-sm" aria-label="Close" onClick={onClose} />
      <aside className="card relative z-10 h-full w-full max-w-md overflow-y-auto rounded-none border-y-0 border-r-0 p-6 shadow-[-20px_0_60px_rgba(26,92,255,0.12)]">
        <div aria-hidden className="brand-gradient absolute inset-x-0 top-0 h-0.5" />
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-sans text-lg font-semibold">{title}</h2>
          <button type="button" className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </aside>
    </div>
  );
}
