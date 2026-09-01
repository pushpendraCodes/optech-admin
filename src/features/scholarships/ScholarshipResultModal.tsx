import { Modal } from "@/components/Modal";
import { StatusBadge } from "@/components/Chrome";
import { isoDate } from "@/utils/format";

export type ScholarshipResultRow = {
  _id?: string;
  name?: string;
  phone?: string;
  email?: string;
  score?: number;
  percent?: number;
  correct?: number;
  wrong?: number;
  skipped?: number;
  timeTakenSeconds?: number;
  couponCode?: string;
  redeemedAt?: string;
  createdAt?: string;
  exam?: { title?: string; totalMarks?: number; slabs?: { minPercent?: number; couponPercent?: number }[] };
  student?: { studentCode?: string };
};

function formatDuration(sec?: number) {
  if (sec == null) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function estimateMax(row: ScholarshipResultRow) {
  const score = Number(row.score ?? 0);
  const percent = Number(row.percent ?? 0);
  if (percent > 0) return Math.round((score / percent) * 100);
  const examMax = Number(row.exam?.totalMarks ?? 0);
  if (examMax > 0) return examMax;
  return score || 0;
}

function ScoreRing({ percent }: { percent: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, percent));
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
          stroke="#d4a22f"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-sans text-3xl font-semibold">{Math.round(clamped)}%</span>
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-zinc-500">Score</span>
      </div>
    </div>
  );
}

function BreakdownChart({
  correct,
  wrong,
  skipped,
}: {
  correct: number;
  wrong: number;
  skipped: number;
}) {
  const total = correct + wrong + skipped || 1;
  const segments = [
    { label: "Correct", value: correct, color: "#34d399" },
    { label: "Wrong", value: wrong, color: "#f87171" },
    { label: "Skipped", value: skipped, color: "#71717a" },
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
          <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-zinc-500">Questions</span>
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

export function ScholarshipResultModal({
  open,
  row,
  onClose,
}: {
  open: boolean;
  row: ScholarshipResultRow | null;
  onClose: () => void;
}) {
  if (!row) return null;

  const percent = Number(row.percent ?? 0);
  const correct = Number(row.correct ?? 0);
  const wrong = Number(row.wrong ?? 0);
  const skipped = Number(row.skipped ?? 0);
  const score = Number(row.score ?? 0);
  const max = estimateMax(row);
  const passed = Boolean(row.couponCode);
  const slabs = row.exam?.slabs ?? [];

  return (
    <Modal open={open} title="Scholarship exam result" onClose={onClose}>
      <div className="max-h-[75vh] space-y-5 overflow-y-auto pr-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-sans text-lg font-semibold">{row.name ?? "—"}</p>
            <p className="text-sm text-zinc-400">{row.exam?.title ?? "Scholarship exam"}</p>
          </div>
          <StatusBadge value={passed ? "passed" : "no coupon"} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
            <ScoreRing percent={percent} />
          </div>
          <div className="grid grid-cols-2 gap-2 content-center">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-500">Marks</p>
              <p className="mt-1 font-sans text-xl font-semibold">
                {score}
                <span className="text-sm text-zinc-500"> / {max}</span>
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-500">Time</p>
              <p className="mt-1 font-sans text-xl font-semibold">{formatDuration(row.timeTakenSeconds)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-500">Correct</p>
              <p className="mt-1 font-sans text-xl font-semibold text-emerald-300">{correct}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-500">Wrong</p>
              <p className="mt-1 font-sans text-xl font-semibold text-red-300">{wrong}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <p className="mb-3 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Answer breakdown</p>
          <BreakdownChart correct={correct} wrong={wrong} skipped={skipped} />
        </div>

        <div className="rounded-xl border border-white/10 p-4">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Candidate details</p>
          <dl className="text-sm">
            <DetailRow label="Phone" value={row.phone ?? "—"} />
            <DetailRow label="Email" value={row.email || "—"} />
            <DetailRow label="Student ID" value={row.student?.studentCode ?? "Guest / not linked"} />
            <DetailRow label="Attempted on" value={row.createdAt ? isoDate(String(row.createdAt)) : "—"} />
          </dl>
        </div>

        <div className={`rounded-xl border p-4 ${passed ? "border-accent/30 bg-accent/10" : "border-white/10 bg-white/[0.02]"}`}>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Scholarship outcome</p>
          {passed ? (
            <>
              <p className="mt-2 text-sm text-emerald-300">Qualified for a discount slab — coupon issued.</p>
              <p className="mt-2 font-mono text-lg tracking-wider text-accent">{row.couponCode}</p>
              {row.redeemedAt ? (
                <p className="mt-2 text-xs text-zinc-500">Coupon redeemed on {isoDate(String(row.redeemedAt))}</p>
              ) : (
                <p className="mt-2 text-xs text-zinc-500">Coupon not yet redeemed on enrollment.</p>
              )}
            </>
          ) : (
            <p className="mt-2 text-sm text-zinc-400">Did not reach a discount slab. No coupon issued.</p>
          )}
          {slabs.length ? (
            <ul className="mt-3 space-y-1 border-t border-white/8 pt-3 text-xs text-zinc-500">
              {slabs.map((s, i) => (
                <li key={i} className={percent >= Number(s.minPercent ?? 0) ? "text-accent" : ""}>
                  {s.minPercent}%+ → {s.couponPercent}% off
                  {percent >= Number(s.minPercent ?? 0) ? " · matched" : ""}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
