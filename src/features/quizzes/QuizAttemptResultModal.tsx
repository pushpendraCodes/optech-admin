import { Modal } from "@/components/Modal";
import { StatusBadge } from "@/components/Chrome";
import { isoDate, loc } from "@/utils/format";

export type QuizAttemptRow = {
  _id?: string;
  status?: string;
  score?: number;
  percent?: number;
  correct?: number;
  wrong?: number;
  skipped?: number;
  timeTakenSeconds?: number;
  startedAt?: string;
  submittedAt?: string;
  createdAt?: string;
  student?: {
    studentCode?: string;
    rollNumber?: string;
    user?: { name?: string; email?: string; phone?: string };
    batch?: { label?: string; timing?: string };
  };
  quiz?: {
    title?: string;
    passing?: number;
    minutes?: number;
    negative?: boolean;
    negativeValue?: number;
    totalMarks?: number;
    subject?: string;
    course?: { title?: unknown };
  };
};

function formatDuration(sec?: number) {
  if (sec == null) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDateTime(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function estimateMax(row: QuizAttemptRow) {
  const score = Number(row.score ?? 0);
  const percent = Number(row.percent ?? 0);
  const quizMax = Number(row.quiz?.totalMarks ?? 0);
  if (quizMax > 0) return quizMax;
  if (percent > 0) return Math.round((score / percent) * 100);
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

function studentName(row: QuizAttemptRow) {
  return row.student?.user?.name || row.student?.studentCode || "—";
}

export function QuizAttemptResultModal({
  open,
  row,
  onClose,
}: {
  open: boolean;
  row: QuizAttemptRow | null;
  onClose: () => void;
}) {
  if (!row) return null;

  const inProgress = row.status === "in_progress";
  const percent = Number(row.percent ?? 0);
  const correct = Number(row.correct ?? 0);
  const wrong = Number(row.wrong ?? 0);
  const skipped = Number(row.skipped ?? 0);
  const score = Number(row.score ?? 0);
  const max = estimateMax(row);
  const passing = Number(row.quiz?.passing ?? 0);
  const passed = !inProgress && percent >= passing;

  return (
    <Modal open={open} title="Quiz attempt result" onClose={onClose}>
      <div className="max-h-[75vh] space-y-5 overflow-y-auto pr-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-sans text-lg font-semibold">{studentName(row)}</p>
            <p className="text-sm text-zinc-400">{row.quiz?.title ?? "Mock test"}</p>
            {row.quiz?.course ? (
              <p className="mt-1 text-xs text-zinc-500">{loc(row.quiz.course.title)}</p>
            ) : null}
          </div>
          <StatusBadge value={inProgress ? "in progress" : passed ? "passed" : "failed"} />
        </div>

        {inProgress ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center">
            <p className="text-sm text-zinc-400">This attempt is still in progress. Results will appear after the student submits.</p>
            <p className="mt-2 font-mono text-xs text-zinc-500">Started {formatDateTime(row.startedAt ? String(row.startedAt) : undefined)}</p>
          </div>
        ) : (
          <>
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
                  <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-500">Pass mark</p>
                  <p className="mt-1 font-sans text-xl font-semibold">{passing}%</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
                  <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-500">Time</p>
                  <p className="mt-1 font-sans text-xl font-semibold">{formatDuration(row.timeTakenSeconds)}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
                  <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-500">Duration</p>
                  <p className="mt-1 font-sans text-xl font-semibold">{row.quiz?.minutes ?? "—"} min</p>
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
          </>
        )}

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
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Quiz details</p>
          <dl className="text-sm">
            <DetailRow label="Test" value={row.quiz?.title ?? "—"} />
            <DetailRow label="Course" value={row.quiz?.course ? loc(row.quiz.course.title) : "—"} />
            <DetailRow label="Subject" value={row.quiz?.subject || "—"} />
            <DetailRow label="Negative marking" value={row.quiz?.negative ? `Yes (${row.quiz.negativeValue ?? 0})` : "No"} />
            <DetailRow label="Status" value={String(row.status ?? "—").replace(/_/g, " ")} />
            <DetailRow label="Started" value={formatDateTime(row.startedAt ? String(row.startedAt) : undefined)} />
            <DetailRow label="Submitted" value={formatDateTime(row.submittedAt ? String(row.submittedAt) : undefined)} />
            <DetailRow label="Recorded" value={row.createdAt ? isoDate(String(row.createdAt)) : "—"} />
          </dl>
        </div>
      </div>
    </Modal>
  );
}
