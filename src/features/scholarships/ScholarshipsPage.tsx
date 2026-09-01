import { useState } from "react";
import { PageHeader, EmptyState, Skeleton, StatusBadge } from "@/components/Chrome";
import { Button } from "@/components/Button";
import { Field, Input, Select } from "@/components/Field";
import { ConfirmDialog } from "@/components/Modal";
import { useActionMutation, useListQuery, useRemoveMutation } from "@/app/api";
import { toast } from "@/components/Toast";
import { useCan } from "@/hooks/useAuth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { ScholarshipEditorModal } from "./ScholarshipEditorModal";
import { ScholarshipResultModal, type ScholarshipResultRow } from "./ScholarshipResultModal";

export function ScholarshipsPage() {
  const canWrite = useCan("scholarship:write");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [activeFilter, setActiveFilter] = useState("");
  const [editorId, setEditorId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [viewResult, setViewResult] = useState<ScholarshipResultRow | null>(null);
  const debounced = useDebouncedValue(search);

  const extra: Record<string, string> = {};
  if (activeFilter) extra.active = activeFilter;

  const { data, isLoading, isError, refetch } = useListQuery({ resource: "scholarships", page, search: debounced, extra });
  const attempts = useListQuery({ resource: "scholarship-results", page: 1, limit: 50 });
  const [act] = useActionMutation();
  const [remove, removeState] = useRemoveMutation();

  const rows = data?.data ?? [];
  const meta = data?.meta;
  const attemptRows = attempts.data?.data ?? [];

  async function toggleActive(id: string, active: boolean) {
    try {
      await act({ path: `scholarships/${id}/${active ? "activate" : "deactivate"}` }).unwrap();
      toast(active ? "Exam activated (public on website)" : "Exam deactivated");
      refetch();
    } catch {
      toast("Status change failed", "error");
    }
  }

  return (
    <div>
      <PageHeader
        title="Scholarship exams"
        description="Public exams on the website. Guests register with name & phone; logged-in students can attempt directly. Only one exam can be active at a time."
        actions={canWrite ? <Button type="button" onClick={() => { setEditorId(null); setEditorOpen(true); }}>New exam</Button> : null}
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Search"><Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Title…" /></Field>
        <Field label="Status">
          <Select value={activeFilter} onChange={(e) => { setActiveFilter(e.target.value); setPage(1); }}>
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </Select>
        </Field>
      </div>

      {isLoading ? (
        <Skeleton className="h-40" />
      ) : isError ? (
        <EmptyState title="Could not load exams" body="Retry after the API is up." action={<Button onClick={() => refetch()}>Retry</Button>} />
      ) : rows.length === 0 ? (
        <EmptyState title="No scholarship exams" body="Create an exam with questions and discount slabs." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="border-b border-white/8 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              <tr>
                <th className="px-4 py-3 text-left">Title</th>
                <th className="px-4 py-3 text-left">Questions</th>
                <th className="px-4 py-3 text-left">Marks</th>
                <th className="px-4 py-3 text-left">Duration</th>
                <th className="px-4 py-3 text-left">Slabs</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={String(row._id)} className="border-b border-white/5">
                  <td className="px-4 py-3 font-medium">{String(row.title)}</td>
                  <td className="px-4 py-3">{String(row.questionCount ?? (Array.isArray(row.questions) ? row.questions.length : 0))}</td>
                  <td className="px-4 py-3">{String(row.totalMarks ?? "—")}</td>
                  <td className="px-4 py-3">{String(row.minutes)} min</td>
                  <td className="px-4 py-3 text-xs text-zinc-400">
                    {((row.slabs as { minPercent?: number; couponPercent?: number }[]) ?? []).map((s, i) => (
                      <div key={i}>{s.minPercent}%+ → {s.couponPercent}%</div>
                    ))}
                  </td>
                  <td className="px-4 py-3"><StatusBadge value={row.active ? "active" : "inactive"} /></td>
                  <td className="px-4 py-3">
                    {canWrite ? (
                      <div className="flex flex-wrap gap-1">
                        <Button type="button" variant="ghost" onClick={() => { setEditorId(String(row._id)); setEditorOpen(true); }}>Edit</Button>
                        <Button type="button" variant="ghost" onClick={() => void toggleActive(String(row._id), !row.active)}>
                          {row.active ? "Deactivate" : "Activate"}
                        </Button>
                        <Button type="button" variant="danger" onClick={() => setRemoveId(String(row._id))}>Delete</Button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {meta && (meta.totalPages ?? 1) > 1 ? (
        <div className="mt-4 flex gap-2">
          <Button type="button" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="font-mono text-xs text-zinc-500">Page {page} / {meta.totalPages ?? 1}</span>
          <Button type="button" variant="ghost" disabled={page >= (meta.totalPages ?? 1)} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      ) : null}

      <article className="card mt-8 p-5">
        <h2 className="mb-3 font-sans text-lg font-semibold">Student attempts</h2>
        {attempts.isLoading ? (
          <Skeleton className="h-24" />
        ) : attemptRows.length === 0 ? (
          <p className="text-sm text-zinc-500">No attempts yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="border-b border-white/8 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                <tr>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Phone</th>
                  <th className="px-3 py-2 text-left">Exam</th>
                  <th className="px-3 py-2 text-left">Score</th>
                  <th className="px-3 py-2 text-left">Result</th>
                  <th className="px-3 py-2 text-left">Coupon</th>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {attemptRows.map((a) => (
                  <tr key={String(a._id)} className="border-b border-white/5">
                    <td className="px-3 py-2">{String(a.name)}</td>
                    <td className="px-3 py-2">{String(a.phone)}</td>
                    <td className="px-3 py-2">{String((a.exam as { title?: string } | undefined)?.title ?? "—")}</td>
                    <td className="px-3 py-2">
                      <span className="font-semibold text-accent">{a.percent != null ? `${Math.round(Number(a.percent))}%` : "—"}</span>
                      <span className="ml-2 text-xs text-zinc-500">
                        {a.score != null ? `${a.score} marks` : ""}
                        {a.correct != null ? ` · ${a.correct}✓ ${a.wrong ?? 0}✗` : ""}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge value={a.couponCode ? "passed" : "no coupon"} />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-accent">{String(a.couponCode ?? "—")}</td>
                    <td className="px-3 py-2 text-xs text-zinc-500">{a.createdAt ? String(a.createdAt).slice(0, 16).replace("T", " ") : "—"}</td>
                    <td className="px-3 py-2">
                      <Button type="button" variant="ghost" onClick={() => setViewResult(a as ScholarshipResultRow)}>
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <ScholarshipEditorModal open={editorOpen} examId={editorId} onClose={() => setEditorOpen(false)} onSaved={() => refetch()} />
      <ScholarshipResultModal open={Boolean(viewResult)} row={viewResult} onClose={() => setViewResult(null)} />
      <ConfirmDialog
        open={Boolean(removeId)}
        title="Delete exam?"
        body="This removes the exam configuration. Attempt history is kept."
        busy={removeState.isLoading}
        onConfirm={async () => {
          if (!removeId) return;
          try {
            await remove({ resource: "scholarships", id: removeId }).unwrap();
            toast("Exam deleted");
            setRemoveId(null);
            refetch();
          } catch {
            toast("Delete failed", "error");
          }
        }}
        onClose={() => setRemoveId(null)}
      />
    </div>
  );
}
