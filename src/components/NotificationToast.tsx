import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, X } from "lucide-react";

export type ToastItem = {
  id: string;
  title: string;
  body: string;
  link?: string;
};

let _addToast: ((t: ToastItem) => void) | null = null;

/** Call this from anywhere to show a live notification toast */
export function showLiveToast(title: string, body: string, link?: string) {
  if (_addToast) {
    _addToast({ id: `${Date.now()}-${Math.random()}`, title, body, link });
  }
}

const DURATION_MS = 6000;

export function NotificationToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    _addToast = (t) => setToasts((prev) => [t, ...prev].slice(0, 5));
    return () => {
      _addToast = null;
    };
  }, []);

  function dismiss(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2" aria-live="polite">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} duration={DURATION_MS} />
      ))}
    </div>
  );
}

function ToastCard({
  toast,
  onDismiss,
  duration,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
  duration: number;
}) {
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), duration);
    return () => clearTimeout(t);
  }, [toast.id, onDismiss, duration]);

  function openLink() {
    if (!toast.link) return;
    onDismiss(toast.id);
    if (toast.link.startsWith("http")) {
      window.open(toast.link, "_blank", "noopener,noreferrer");
      return;
    }
    navigate(toast.link.startsWith("/") ? toast.link : `/${toast.link}`);
  }

  const inner = (
    <>
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent">
        <Bell size={14} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground">
          {toast.title}
        </p>
        {toast.body ? (
          <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">{toast.body}</p>
        ) : null}
        {toast.link ? (
          <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-accent">Tap to open</p>
        ) : null}
      </div>
      <button
        type="button"
        className="shrink-0 text-zinc-500 hover:text-foreground"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(toast.id);
        }}
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </>
  );

  if (toast.link) {
    return (
      <button
        type="button"
        onClick={openLink}
        className="flex w-80 cursor-pointer items-start gap-3 rounded-2xl border border-accent/30 bg-black/90 p-4 text-left shadow-2xl backdrop-blur-xl transition-colors hover:border-accent/50"
      >
        {inner}
      </button>
    );
  }

  return (
    <div className="flex w-80 items-start gap-3 rounded-2xl border border-accent/30 bg-black/90 p-4 shadow-2xl backdrop-blur-xl">
      {inner}
    </div>
  );
}
