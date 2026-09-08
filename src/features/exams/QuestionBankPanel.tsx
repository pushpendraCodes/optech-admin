import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/Button";
import { Field, Input, Select, Textarea } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { EmptyState, Skeleton } from "@/components/Chrome";
import { useActionMutation, useCreateMutation, useListQuery, usePatchMutation, useRemoveMutation } from "@/app/api";
import { toast } from "@/components/Toast";
import { useCan } from "@/hooks/useAuth";
import { loc } from "@/utils/format";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { downloadImportTemplate, parseImportFile, type ImportRowRecord } from "./utils/quizExcel";
import { ExcelImportWizard } from "./ExcelImportWizard";

const questionSchema = z.object({
  prompt: z.string().min(4),
  optionA: z.string().min(1),
  optionB: z.string().min(1),
  optionC: z.string().optional(),
  optionD: z.string().optional(),
  answerIndex: z.coerce.number().min(0).max(3),
  marks: z.coerce.number().min(0),
  negativeMarks: z.coerce.number().min(0),
  difficulty: z.enum(["easy", "medium", "hard"]),
  explanation: z.string().optional(),
  topic: z.string().optional(),
  tags: z.string().optional(),
  course: z.string().optional(),
  subject: z.string().optional(),
});

type QuestionForm = z.infer<typeof questionSchema>;

function toBody(values: QuestionForm) {
  const options = [values.optionA, values.optionB, values.optionC, values.optionD].filter(Boolean) as string[];
  return {
    type: "mcq",
    prompt: values.prompt,
    options,
    answerIndex: Math.min(values.answerIndex, options.length - 1),
    marks: values.marks,
    negativeMarks: values.negativeMarks,
    difficulty: values.difficulty,
    explanation: values.explanation || undefined,
    topic: values.topic || undefined,
    tags: values.tags ? values.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
    course: values.course || undefined,
    subject: values.subject || undefined,
  };
}

export function QuestionBankPanel() {
  const canWrite = useCan("quiz:write");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [course, setCourse] = useState("");
  const debounced = useDebouncedValue(search);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editRow, setEditRow] = useState<Record<string, unknown> | null>(null);

  const extra = useMemo(() => {
    const q: Record<string, string> = {};
    if (subject) q.subject = subject;
    if (topic) q.topic = topic;
    if (difficulty) q.difficulty = difficulty;
    if (course) q.course = course;
    return q;
  }, [subject, topic, difficulty, course]);

  const { data, isLoading, refetch } = useListQuery({
    resource: "question-bank",
    page,
    limit: 20,
    search: debounced,
    extra,
  });
  const courses = useListQuery({ resource: "courses", page: 1 });
  const [create, createState] = useCreateMutation();
  const [patch, patchState] = usePatchMutation();
  const [remove] = useRemoveMutation();
  const form = useForm<QuestionForm>({
    resolver: zodResolver(questionSchema),
    defaultValues: { marks: 1, negativeMarks: 0, difficulty: "medium", answerIndex: 0 },
  });

  const rows = data?.data ?? [];
  const meta = data?.meta;

  function openEdit(row: Record<string, unknown>) {
    const options = Array.isArray(row.options) ? row.options.map(String) : ["", ""];
    form.reset({
      prompt: String(row.prompt ?? ""),
      optionA: options[0] ?? "",
      optionB: options[1] ?? "",
      optionC: options[2] ?? "",
      optionD: options[3] ?? "",
      answerIndex: Number(row.answerIndex ?? 0),
      marks: Number(row.marks ?? 1),
      negativeMarks: Number(row.negativeMarks ?? 0),
      difficulty: (row.difficulty as QuestionForm["difficulty"]) ?? "medium",
      explanation: String(row.explanation ?? ""),
      topic: String(row.topic ?? ""),
      tags: Array.isArray(row.tags) ? row.tags.map(String).join(", ") : "",
      course: row.course && typeof row.course === "object" && "_id" in (row.course as object) ? String((row.course as { _id: unknown })._id) : String(row.course ?? ""),
      subject: String(row.subject ?? ""),
    });
    setEditRow(row);
    setFormOpen(true);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Search">
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Question, topic, tags…" />
        </Field>
        <Field label="Subject">
          <Input value={subject} onChange={(e) => { setSubject(e.target.value); setPage(1); }} />
        </Field>
        <Field label="Topic">
          <Input value={topic} onChange={(e) => { setTopic(e.target.value); setPage(1); }} />
        </Field>
        <Field label="Difficulty">
          <Select value={difficulty} onChange={(e) => { setDifficulty(e.target.value); setPage(1); }}>
            <option value="">All</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </Select>
        </Field>
        <Field label="Course">
          <Select value={course} onChange={(e) => { setCourse(e.target.value); setPage(1); }}>
            <option value="">All</option>
            {(courses.data?.data ?? []).map((c) => (
              <option key={String(c._id)} value={String(c._id)}>{loc(c.title)}</option>
            ))}
          </Select>
        </Field>
        {canWrite ? (
          <div className="ml-auto flex flex-wrap gap-2">
            <Button type="button" variant="ghost" onClick={() => downloadImportTemplate()}>Download template</Button>
            <Button type="button" variant="ghost" onClick={() => setImportOpen(true)}>Import Excel</Button>
            <Button type="button" onClick={() => { setEditRow(null); form.reset({ marks: 1, negativeMarks: 0, difficulty: "medium", answerIndex: 0 }); setFormOpen(true); }}>Add question</Button>
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <Skeleton className="h-40" />
      ) : rows.length === 0 ? (
        <EmptyState title="No questions" body="Add manually or import from Excel." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-white/8 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              <tr>
                <th className="px-4 py-3 text-left">Question</th>
                <th className="px-4 py-3 text-left">Course</th>
                <th className="px-4 py-3 text-left">Topic</th>
                <th className="px-4 py-3 text-left">Difficulty</th>
                <th className="px-4 py-3 text-left">Marks</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={String(row._id)} className="border-b border-white/5">
                  <td className="max-w-md truncate px-4 py-3">{String(row.prompt)}</td>
                  <td className="px-4 py-3">{loc((row.course as { title?: unknown } | undefined)?.title) || "—"}</td>
                  <td className="px-4 py-3">{String(row.topic ?? "—")}</td>
                  <td className="px-4 py-3 capitalize">{String(row.difficulty ?? "medium")}</td>
                  <td className="px-4 py-3">{String(row.marks ?? 1)}</td>
                  <td className="px-4 py-3">
                    {canWrite ? (
                      <div className="flex gap-2">
                        <Button type="button" variant="ghost" onClick={() => openEdit(row)}>Edit</Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={async () => {
                            try {
                              await remove({ resource: "question-bank", id: String(row._id) }).unwrap();
                              toast("Question removed");
                              refetch();
                            } catch {
                              toast("Delete failed", "error");
                            }
                          }}
                        >
                          Delete
                        </Button>
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

      <Modal open={formOpen} title={editRow ? "Edit question" : "New question"} onClose={() => setFormOpen(false)}>
        <form
          className="grid max-h-[70vh] gap-3 overflow-y-auto pr-1"
          onSubmit={form.handleSubmit(async (values) => {
            try {
              const body = toBody(values);
              if (editRow) {
                await patch({ resource: "question-bank", id: String(editRow._id), body }).unwrap();
                toast("Question updated");
              } else {
                await create({ resource: "question-bank", body }).unwrap();
                toast("Question saved");
              }
              setFormOpen(false);
              refetch();
            } catch {
              toast("Save failed", "error");
            }
          })}
        >
          <Field label="Question" error={form.formState.errors.prompt?.message}><Textarea {...form.register("prompt")} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Course"><Select {...form.register("course")}><option value="">Optional</option>{(courses.data?.data ?? []).map((c) => (<option key={String(c._id)} value={String(c._id)}>{loc(c.title)}</option>))}</Select></Field>
            <Field label="Subject"><Input {...form.register("subject")} /></Field>
          </div>
          <Field label="Option A"><Input {...form.register("optionA")} /></Field>
          <Field label="Option B"><Input {...form.register("optionB")} /></Field>
          <Field label="Option C"><Input {...form.register("optionC")} /></Field>
          <Field label="Option D"><Input {...form.register("optionD")} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Correct index (0–3)"><Input type="number" {...form.register("answerIndex")} /></Field>
            <Field label="Difficulty"><Select {...form.register("difficulty")}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></Select></Field>
            <Field label="Marks"><Input type="number" step="0.25" {...form.register("marks")} /></Field>
            <Field label="Negative marks"><Input type="number" step="0.25" {...form.register("negativeMarks")} /></Field>
          </div>
          <Field label="Topic"><Input {...form.register("topic")} /></Field>
          <Field label="Tags (comma-separated)"><Input {...form.register("tags")} /></Field>
          <Field label="Explanation"><Textarea {...form.register("explanation")} /></Field>
          <Button type="submit" disabled={createState.isLoading || patchState.isLoading}>{editRow ? "Update" : "Save"}</Button>
        </form>
      </Modal>

      <ExcelImportWizard
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onDone={() => { setImportOpen(false); refetch(); }}
        defaultCourse={course}
        defaultSubject={subject}
      />
    </div>
  );
}

export type { ImportRowRecord };
