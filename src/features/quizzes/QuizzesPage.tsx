import { useState } from "react";
import { PageHeader, EmptyState, Skeleton, StatusBadge } from "@/components/Chrome";
import { Button } from "@/components/Button";
import { Field, Input, Select } from "@/components/Field";
import { ConfirmDialog } from "@/components/Modal";
import { useActionMutation, useListQuery, useRemoveMutation } from "@/app/api";
import { toast } from "@/components/Toast";
import { useCan } from "@/hooks/useAuth";
import { loc } from "@/utils/format";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { QuestionBankPanel } from "./QuestionBankPanel";
import { QuizEditorModal } from "./QuizEditorModal";
import { QuizAttemptResultModal, type QuizAttemptRow } from "./QuizAttemptResultModal";

export function QuizzesPage() {
  const canWrite = useCan("quiz:write");
  const [tab, setTab] = useState<"tests" | "bank">("tests");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [courseFilter, setCourseFilter] = useState("");
  const [openFilter, setOpenFilter] = useState("");
  const debounced = useDebouncedValue(search);
  const [editorId, setEditorId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [attemptsPage, setAttemptsPage] = useState(1);
  const [viewAttempt, setViewAttempt] = useState<QuizAttemptRow | null>(null);

  const extra: Record<string, string> = {};
  if (courseFilter) extra.course = courseFilter;
  if (openFilter) extra.open = openFilter;

  const { data, isLoading, isError, refetch } = useListQuery({ resource: "quizzes", page, search: debounced, extra });
  const attempts = useListQuery({ resource: "quiz-attempts", page: attemptsPage, limit: 20 });
  const courses = useListQuery({ resource: "courses", page: 1 });
  const [act] = useActionMutation();
  const [remove, removeState] = useRemoveMutation();

  const rows = data?.data ?? [];
  const meta = data?.meta;
  const attemptRows = (attempts.data?.data ?? []) as QuizAttemptRow[];
  const attemptsMeta = attempts.data?.meta;

  function attemptStudentName(a: QuizAttemptRow) {
    return a.student?.user?.name || a.student?.studentCode || "—";
  }

  function attemptQuizTitle(a: QuizAttemptRow) {
    return a.quiz?.title ?? "—";
  }

  function attemptCourse(a: QuizAttemptRow) {
    return a.quiz?.course ? loc(a.quiz.course.title) : "—";
  }

  function attemptPassed(a: QuizAttemptRow) {
    if (a.status === "in_progress") return null;
    const passing = Number(a.quiz?.passing ?? 0);
    return Number(a.percent ?? 0) >= passing;
  }

  async function togglePublish(id: string, publish: boolean) {
    try {
      await act({ path: `quizzes/${id}/${publish ? "publish" : "unpublish"}` }).unwrap();
      toast(publish ? "Test published" : "Test unpublished");
      refetch();
    } catch {
      toast("Action failed", "error");
    }
  }

  return (
    <div>
      <PageHeader
        title="Mock tests & quizzes"
        description="Create timed mock tests, manage a reusable question bank, and import bulk questions from Excel."
        actions={
          canWrite && tab === "tests" ? (
            <Button type="button" onClick={() => { setEditorId(null); setEditorOpen(true); }}>New mock test</Button>
          ) : null
        }
      />

      <div className="mb-6 flex gap-2">
        <Button type="button" variant={tab === "tests" ? "primary" : "ghost"} onClick={() => setTab("tests")}>Mock tests</Button>
        <Button type="button" variant={tab === "bank" ? "primary" : "ghost"} onClick={() => setTab("bank")}>Question bank</Button>
      </div>

      {tab === "bank" ? <QuestionBankPanel /> : (
        <>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <Field label="Search"><Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Title…" /></Field>
            <Field label="Course">
              <Select value={courseFilter} onChange={(e) => { setCourseFilter(e.target.value); setPage(1); }}>
                <option value="">All</option>
                {(courses.data?.data ?? []).map((c) => (<option key={String(c._id)} value={String(c._id)}>{loc(c.title)}</option>))}
              </Select>
            </Field>
            <Field label="Status">
              <Select value={openFilter} onChange={(e) => { setOpenFilter(e.target.value); setPage(1); }}>
                <option value="">All</option>
                <option value="true">Published</option>
                <option value="false">Draft</option>
              </Select>
            </Field>
          </div>

          {isLoading ? (
            <Skeleton className="h-40" />
          ) : isError ? (
            <EmptyState title="Could not load tests" body="Retry after the API is up." action={<Button onClick={() => refetch()}>Retry</Button>} />
          ) : rows.length === 0 ? (
            <EmptyState title="No mock tests" body="Create a test with questions from manual entry or the question bank." />
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[960px] text-sm">
                <thead className="border-b border-white/8 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Title</th>
                    <th className="px-4 py-3 text-left">Course</th>
                    <th className="px-4 py-3 text-left">Questions</th>
                    <th className="px-4 py-3 text-left">Marks</th>
                    <th className="px-4 py-3 text-left">Duration</th>
                    <th className="px-4 py-3 text-left">Pass %</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={String(row._id)} className="border-b border-white/5">
                      <td className="px-4 py-3">
                        <div className="font-medium">{String(row.title)}</div>
                        {row.subject ? <div className="text-xs text-zinc-500">{String(row.subject)}</div> : null}
                      </td>
                      <td className="px-4 py-3">{loc((row.course as { title?: unknown } | undefined)?.title)}</td>
                      <td className="px-4 py-3">{String(row.questionCount ?? (Array.isArray(row.questions) ? row.questions.length : 0))}</td>
                      <td className="px-4 py-3">{String(row.totalMarks ?? "—")}</td>
                      <td className="px-4 py-3">{String(row.minutes)} min</td>
                      <td className="px-4 py-3">{String(row.passing)}%</td>
                      <td className="px-4 py-3"><StatusBadge value={row.open ? "open" : "closed"} /></td>
                      <td className="px-4 py-3">
                        {canWrite ? (
                          <div className="flex flex-wrap gap-1">
                            <Button type="button" variant="ghost" onClick={() => { setEditorId(String(row._id)); setEditorOpen(true); }}>Edit</Button>
                            <Button type="button" variant="ghost" onClick={() => void togglePublish(String(row._id), !row.open)}>
                              {row.open ? "Unpublish" : "Publish"}
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
            <div className="mt-4 flex items-center gap-2">
              <Button type="button" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <span className="font-mono text-xs text-zinc-500">Page {page} / {meta.totalPages ?? 1}</span>
              <Button type="button" variant="ghost" disabled={page >= (meta.totalPages ?? 1)} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          ) : null}

          <article className="card mt-6 p-5">
            <h2 className="mb-3 font-sans text-lg font-semibold">Student attempts</h2>
            {attempts.isLoading ? (
              <Skeleton className="h-32" />
            ) : attemptRows.length === 0 ? (
              <p className="text-sm text-zinc-500">No attempts yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] text-sm">
                  <thead className="border-b border-white/8 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Student</th>
                      <th className="px-3 py-2 text-left">Student ID</th>
                      <th className="px-3 py-2 text-left">Quiz</th>
                      <th className="px-3 py-2 text-left">Course</th>
                      <th className="px-3 py-2 text-left">Score</th>
                      <th className="px-3 py-2 text-left">Result</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-left">Submitted</th>
                      <th className="px-3 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attemptRows.map((a) => {
                      const passed = attemptPassed(a);
                      return (
                        <tr key={String(a._id)} className="border-b border-white/5">
                          <td className="px-3 py-2">
                            <div className="font-medium">{attemptStudentName(a)}</div>
                            <div className="text-xs text-zinc-500">{a.student?.user?.phone ?? "—"}</div>
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">{a.student?.studentCode ?? "—"}</td>
                          <td className="px-3 py-2">{attemptQuizTitle(a)}</td>
                          <td className="px-3 py-2">{attemptCourse(a)}</td>
                          <td className="px-3 py-2">
                            {a.status === "in_progress" ? (
                              <span className="text-zinc-500">In progress</span>
                            ) : (
                              <>
                                <span className="font-semibold text-accent">
                                  {a.percent != null ? `${Math.round(Number(a.percent))}%` : "—"}
                                </span>
                                <span className="ml-2 text-xs text-zinc-500">
                                  {a.score != null ? `${a.score} marks` : ""}
                                  {a.correct != null ? ` · ${a.correct}✓ ${a.wrong ?? 0}✗` : ""}
                                </span>
                              </>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {passed == null ? (
                              <StatusBadge value="in progress" />
                            ) : (
                              <StatusBadge value={passed ? "passed" : "failed"} />
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <StatusBadge value={String(a.status ?? "—").replace(/_/g, " ")} />
                          </td>
                          <td className="px-3 py-2 text-xs text-zinc-500">
                            {a.submittedAt ? String(a.submittedAt).slice(0, 16).replace("T", " ") : "—"}
                          </td>
                          <td className="px-3 py-2">
                            <Button type="button" variant="ghost" onClick={() => setViewAttempt(a)}>
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
            {attemptsMeta && (attemptsMeta.totalPages ?? 1) > 1 ? (
              <div className="mt-4 flex items-center gap-2">
                <Button type="button" variant="ghost" disabled={attemptsPage <= 1} onClick={() => setAttemptsPage((p) => p - 1)}>
                  Previous
                </Button>
                <span className="font-mono text-xs text-zinc-500">
                  Page {attemptsMeta.currentPage ?? attemptsPage} / {attemptsMeta.totalPages ?? 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={attemptsPage >= (attemptsMeta.totalPages ?? 1)}
                  onClick={() => setAttemptsPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            ) : null}
          </article>
        </>
      )}

      <QuizEditorModal
        open={editorOpen}
        quizId={editorId}
        onClose={() => setEditorOpen(false)}
        onSaved={() => refetch()}
      />

      <QuizAttemptResultModal open={Boolean(viewAttempt)} row={viewAttempt} onClose={() => setViewAttempt(null)} />

      <ConfirmDialog
        open={Boolean(removeId)}
        title="Delete mock test?"
        body="This removes the test and its configuration. Attempt history may remain."
        busy={removeState.isLoading}
        onConfirm={async () => {
          if (!removeId) return;
          try {
            await remove({ resource: "quizzes", id: removeId }).unwrap();
            toast("Test deleted");
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
