import { Modal } from "@/components/Modal";
import { StatusBadge } from "@/components/Chrome";
import { isoDate } from "@/utils/format";

export type TypingAttemptRow = {
  _id?: string;
  language?: "en" | "hi" | string;
  minutes?: number;
  wpm?: number;
  accuracy?: number;
  errorCount?: number;
  typed?: string;
  source?: string;
  createdAt?: string;
  student?: {
    studentCode?: string;
    rollNumber?: string;
    user?: { name?: string; email?: string; phone?: string };
    batch?: { label?: string; timing?: string };
  };
};

function formatDateTime(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function langLabel(code?: string) {
  if (code === "hi") return "Hindi";
  if (code === "en") return "English";
  return code ?? "—";
}

function wpmRating(wpm: number, language?: string) {
  if (language === "hi") {
    if (wpm >= 35) return { label: "Excellent", tone: "text-emerald-300" };
    if (wpm >= 25) return { label: "Good", tone: "text-accent" };
    if (wpm >= 15) return { label: "Average", tone: "text-sky-300" };
    return { label: "Needs practice", tone: "text-zinc-400" };
  }
  if (wpm >= 60) return { label: "Excellent", tone: "text-emerald-300" };
  if (wpm >= 40) return { label: "Good", tone: "text-accent" };
  if (wpm >= 25) return { label: "Average", tone: "text-sky-300" };
  return { label: "Needs practice", tone: "text-zinc-400" };
}

function AccuracyRing({ value }: { value: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, value));
  const offset = c - (clamped / 100) * c;

  return (
    <div className="relative mx-auto h-36 w-36">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="#34d399"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-sans text-3xl font-semibold">{Math.round(clamped)}%</span>
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-zinc-500">Accuracy</span>
      </div>
    </div>
  );
}

function TypingBreakdownChart({ correct, errors }: { correct: number; errors: number }) {
  const total = correct + errors || 1;
  const segments = [
    { label: "Correct keystrokes", value: correct, color: "#34d399" },
    { label: "Errors", value: errors, color: "#f87171" },
  ];

  const r = 38;
  const c = 2 * Math.PI * r;
  let cumulative = 0;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
      <div className="relative h-32 w-32 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" />
          {segments.map((seg) => {
            const fraction = seg.value / total;
            const dash = fraction * c;
            const gap = c - dash;
            const rotation = (cumulative / total) * 360;
            cumulative += seg.value;
            if (seg.value <= 0) return null;
            return (
              <circle
                key={seg.label}
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth="12"
                strokeDasharray={`${dash} ${gap}`}
                transform={`rotate(${rotation} 50 50)`}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-sans text-xl font-semibold">{total}</span>
          <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-zinc-500">Keystrokes</span>
        </div>
      </div>
      <ul className="w-full space-y-2 sm:w-auto">
        {segments.map((seg) => (
          <li key={seg.label} className="flex items-center justify-between gap-6 text-sm">
            <span className="flex items-center gap-2 text-zinc-400">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: seg.color }} />
              {seg.label}
            </span>
            <span className="font-mono text-zinc-200">
              {seg.value}
              <span className="ml-1 text-zinc-500">({Math.round((seg.value / total) * 100)}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-white/5 py-2 last:border-0">
      <dt className="shrink-0 text-zinc-500">{label}</dt>
      <dd className="text-right text-zinc-100">{value}</dd>
    </div>
  );
}

function studentName(row: TypingAttemptRow) {
  return row.student?.user?.name || row.student?.studentCode || "—";
}

export function TypingAttemptResultModal({
  open,
  row,
  onClose,
}: {
  open: boolean;
  row: TypingAttemptRow | null;
  onClose: () => void;
}) {
  if (!row) return null;

  const wpm = Number(row.wpm ?? 0);
  const accuracy = Number(row.accuracy ?? 0);
  const errors = Number(row.errorCount ?? 0);
  const typedLen = String(row.typed ?? "").length;
  const correct = Math.max(0, typedLen - errors);
  const words = String(row.typed ?? "").trim().split(/\s+/).filter(Boolean).length;
  const rating = wpmRating(wpm, row.language);

  return (
    <Modal open={open} title="Typing test result" onClose={onClose}>
      <div className="max-h-[75vh] space-y-5 overflow-y-auto pr-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-sans text-lg font-semibold">{studentName(row)}</p>
            <p className="text-sm text-zinc-400">
              {langLabel(row.language)} · {row.minutes ?? "—"} min test
            </p>
          </div>
          <StatusBadge value={rating.label.toLowerCase()} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
            <AccuracyRing value={accuracy} />
          </div>
          <div className="grid grid-cols-2 gap-2 content-center">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-500">WPM</p>
              <p className="mt-1 font-sans text-2xl font-semibold text-accent">{wpm}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-500">Rating</p>
              <p className={`mt-1 font-sans text-sm font-semibold ${rating.tone}`}>{rating.label}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-500">Words typed</p>
              <p className="mt-1 font-sans text-xl font-semibold">{words}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-500">Characters</p>
              <p className="mt-1 font-sans text-xl font-semibold">{typedLen}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-500">Errors</p>
              <p className="mt-1 font-sans text-xl font-semibold text-red-300">{errors}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-500">Duration</p>
              <p className="mt-1 font-sans text-xl font-semibold">{row.minutes ?? "—"} min</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <p className="mb-3 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Keystroke breakdown</p>
          <TypingBreakdownChart correct={correct} errors={errors} />
        </div>

        <div className="rounded-xl border border-white/10 p-4">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Student details</p>
          <dl className="text-sm">
            <DetailRow label="Name" value={studentName(row)} />
            <DetailRow label="Student ID" value={row.student?.studentCode ?? "—"} />
            <DetailRow label="Roll no." value={row.student?.rollNumber ?? "—"} />
            <DetailRow label="Phone" value={row.student?.user?.phone ?? "—"} />
            <DetailRow label="Email" value={row.student?.user?.email || "—"} />
            <DetailRow
              label="Batch"
              value={
                row.student?.batch?.label
                  ? `${row.student.batch.label}${row.student.batch.timing ? ` · ${row.student.batch.timing}` : ""}`
                  : "—"
              }
            />
          </dl>
        </div>

        <div className="rounded-xl border border-white/10 p-4">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Passage</p>
          <p className="text-sm leading-relaxed text-zinc-300">{row.source || "—"}</p>
        </div>

        {row.typed ? (
          <div className="rounded-xl border border-white/10 p-4">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Student typed</p>
            <p className="max-h-32 overflow-y-auto text-sm leading-relaxed text-zinc-400">{row.typed}</p>
          </div>
        ) : null}

        <div className="rounded-xl border border-white/10 p-4">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Attempt info</p>
          <dl className="text-sm">
            <DetailRow label="Language" value={langLabel(row.language)} />
            <DetailRow label="Attempted on" value={formatDateTime(row.createdAt ? String(row.createdAt) : undefined)} />
            <DetailRow label="Recorded" value={row.createdAt ? isoDate(String(row.createdAt)) : "—"} />
          </dl>
        </div>
      </div>
    </Modal>
  );
}
