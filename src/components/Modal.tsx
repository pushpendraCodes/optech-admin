import { useEffect } from "react";

export function Modal({
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button className="absolute inset-0 bg-black/70" aria-label="Close" onClick={onClose} />
      <div className="card relative z-10 max-h-[90vh] w-full max-w-xl overflow-y-auto p-6">
        <h2 className="mb-4 font-sans text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  onClose,
  onConfirm,
  busy,
}: {
  open: boolean;
  title: string;
  body: string;
  onClose: () => void;
  onConfirm: () => void;
  busy?: boolean;
}) {
  if (!open) return null;
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <p className="text-sm text-zinc-400">{body}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-white/12 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em]"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className="rounded-full border border-danger/40 bg-danger/15 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-danger disabled:opacity-50"
        >
          {busy ? "Working…" : "Confirm"}
        </button>
      </div>
    </Modal>
  );
}
