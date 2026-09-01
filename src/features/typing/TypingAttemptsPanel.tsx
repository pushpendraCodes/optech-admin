import { useState } from "react";
import { Button } from "@/components/Button";
import { EmptyState, Skeleton, StatusBadge } from "@/components/Chrome";
import { Field, Select } from "@/components/Field";
import { useListQuery } from "@/app/api";
import { TypingAttemptResultModal, type TypingAttemptRow } from "./TypingAttemptResultModal";

function langLabel(code?: string) {
  if (code === "hi") return "Hindi";
  if (code === "en") return "English";
  return code ?? "—";
}

function studentName(row: TypingAttemptRow) {
  return row.student?.user?.name || row.student?.studentCode || "—";
}

function wpmTone(wpm: number, language?: string) {
  if (language === "hi") {
    if (wpm >= 35) return "text-emerald-300";
    if (wpm >= 25) return "text-accent";
    return "text-zinc-300";
  }
  if (wpm >= 60) return "text-emerald-300";
  if (wpm >= 40) return "text-accent";
  return "text-zinc-300";
}

export function TypingAttemptsPanel() {
  const [page, setPage] = useState(1);
  const [language, setLanguage] = useState("");
  const [viewRow, setViewRow] = useState<TypingAttemptRow | null>(null);

  const extra: Record<string, string> = {};
  if (language) extra.language = language;

  const { data, isLoading, isError, refetch } = useListQuery({
    resource: "typing-attempts",
    page,
    limit: 20,
    extra,
  });

  const rows = (data?.data ?? []) as TypingAttemptRow[];
  const meta = data?.meta;

  const avgWpm =
    rows.length > 0 ? Math.round(rows.reduce((sum, row) => sum + Number(row.wpm ?? 0), 0) / rows.length) : 0;
  const avgAcc =
    rows.length > 0
      ? Math.round(rows.reduce((sum, row) => sum + Number(row.accuracy ?? 0), 0) / rows.length)
      : 0;

  return (
    <article className="card p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-sans text-lg font-semibold">Student typing results</h2>
          <p className="mt-1 text-sm text-zinc-400">All portal attempts with WPM, accuracy, and student details.</p>
        </div>
        {rows.length > 0 ? (
          <div className="flex gap-4 text-sm">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Avg WPM (page)</p>
              <p className="font-semibold text-accent">{avgWpm}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Avg accuracy</p>
              <p className="font-semibold">{avgAcc}%</p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Language">
          <Select
            value={language}
            onChange={(e) => {
              setLanguage(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All languages</option>
            <option value="en">English</option>
            <option value="hi">Hindi</option>
          </Select>
        </Field>
      </div>

      {isLoading ? (
        <Skeleton className="h-40" />
      ) : isError ? (
        <EmptyState title="Could not load typing results" body="Retry after the API is up." action={<Button onClick={() => refetch()}>Retry</Button>} />
      ) : rows.length === 0 ? (
        <EmptyState title="No typing attempts yet" body="Results appear when students complete tests in the portal." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="border-b border-white/8 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              <tr>
                <th className="px-3 py-2 text-left">Student</th>
                <th className="px-3 py-2 text-left">Student ID</th>
                <th className="px-3 py-2 text-left">Language</th>
                <th className="px-3 py-2 text-left">Duration</th>
                <th className="px-3 py-2 text-left">WPM</th>
                <th className="px-3 py-2 text-left">Accuracy</th>
                <th className="px-3 py-2 text-left">Errors</th>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const wpm = Number(row.wpm ?? 0);
                const accuracy = Number(row.accuracy ?? 0);
                return (
                  <tr key={String(row._id)} className="border-b border-white/5">
                    <td className="px-3 py-2">
                      <div className="font-medium">{studentName(row)}</div>
                      <div className="text-xs text-zinc-500">{row.student?.user?.phone ?? "—"}</div>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{row.student?.studentCode ?? "—"}</td>
                    <td className="px-3 py-2">
                      <StatusBadge value={langLabel(row.language).toLowerCase()} />
                    </td>
                    <td className="px-3 py-2">{row.minutes ?? "—"} min</td>
                    <td className={`px-3 py-2 font-semibold ${wpmTone(wpm, row.language)}`}>{wpm}</td>
                    <td className="px-3 py-2">{accuracy}%</td>
                    <td className="px-3 py-2 text-red-300">{row.errorCount ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-zinc-500">
                      {row.createdAt ? String(row.createdAt).slice(0, 16).replace("T", " ") : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Button type="button" variant="ghost" onClick={() => setViewRow(row)}>
                        View
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {meta && (meta.totalPages ?? 1) > 1 ? (
        <div className="mt-4 flex items-center gap-2">
          <Button type="button" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="font-mono text-xs text-zinc-500">
            Page {meta.currentPage ?? page} / {meta.totalPages ?? 1} · {meta.totalItems ?? rows.length} results
          </span>
          <Button
            type="button"
            variant="ghost"
            disabled={page >= (meta.totalPages ?? 1)}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}

      <TypingAttemptResultModal open={Boolean(viewRow)} row={viewRow} onClose={() => setViewRow(null)} />
    </article>
  );
}
