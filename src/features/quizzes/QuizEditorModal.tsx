import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/Button";
import { Field, Input, Select, Textarea } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { useCreateMutation, useGetByIdQuery, useListQuery, usePatchMutation } from "@/app/api";
import { toast } from "@/components/Toast";
import { ExamQuestionList } from "@/components/ExamQuestionList";
import { loc } from "@/utils/format";

const metaSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters"),
  description: z.string().optional(),
  course: z.string().min(1, "Select a course"),
  subject: z.string().optional(),
  minutes: z.coerce.number().min(1, "Duration must be at least 1 minute"),
  passing: z.coerce.number().min(0, "Min 0%").max(100, "Max 100%"),
  negative: z.boolean().optional(),
  negativeValue: z.coerce.number().min(0, "Must be 0 or more").optional(),
});

const qSchema = z.object({
  prompt: z.string().min(4, "Question must be at least 4 characters"),
  optionA: z.string().min(1, "Option A is required"),
  optionB: z.string().min(1, "Option B is required"),
  optionC: z.string().optional(),
  optionD: z.string().optional(),
  answerIndex: z.coerce.number().min(0).max(3),
  marks: z.coerce.number().min(0),
  negativeMarks: z.coerce.number().min(0),
  difficulty: z.enum(["easy", "medium", "hard"]),
  explanation: z.string().optional(),
  topic: z.string().optional(),
});

type MetaForm = z.infer<typeof metaSchema>;
type QuestionForm = z.infer<typeof qSchema>;

type QuizQuestion = {
  type: "mcq";
  prompt: string;
  options: string[];
  answerIndex: number;
  marks: number;
  negativeMarks?: number;
  difficulty?: string;
  explanation?: string;
  topic?: string;
  tags?: string[];
  bankId?: string;
};

function manualToQuestion(values: QuestionForm): QuizQuestion {
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
  };
}

function bankRowToQuestion(row: Record<string, unknown>): QuizQuestion {
  return {
    type: "mcq",
    prompt: String(row.prompt ?? ""),
    options: Array.isArray(row.options) ? row.options.map(String) : [],
    answerIndex: Number(row.answerIndex ?? 0),
    marks: Number(row.marks ?? 1),
    negativeMarks: Number(row.negativeMarks ?? 0),
    difficulty: String(row.difficulty ?? "medium"),
    explanation: row.explanation ? String(row.explanation) : undefined,
    topic: row.topic ? String(row.topic) : undefined,
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    bankId: String(row._id),
  };
}

export function QuizEditorModal({
  open,
  quizId,
  onClose,
  onSaved,
}: {
  open: boolean;
  quizId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const courses = useListQuery({ resource: "courses", page: 1, limit: 100 });
  const detail = useGetByIdQuery({ resource: "quizzes", id: quizId ?? "" }, { skip: !quizId });
  const [create, createState] = useCreateMutation();
  const [patch, patchState] = usePatchMutation();
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [selectedBank, setSelectedBank] = useState<string[]>([]);
  const [tab, setTab] = useState<"manual" | "bank">("manual");
  const [formError, setFormError] = useState<string | null>(null);

  const metaForm = useForm<MetaForm>({
    resolver: zodResolver(metaSchema),
    defaultValues: { minutes: 30, passing: 40, negative: false, negativeValue: 0.25 },
  });
  const qForm = useForm<QuestionForm>({
    resolver: zodResolver(qSchema),
    defaultValues: { marks: 1, negativeMarks: 0, difficulty: "medium", answerIndex: 0 },
  });

  const selectedCourse = metaForm.watch("course");
  const bankExtra = useMemo((): Record<string, string> => {
    if (!selectedCourse) return {};
    return { course: selectedCourse };
  }, [selectedCourse]);
  const bank = useListQuery(
    { resource: "question-bank", page: 1, limit: 100, extra: bankExtra },
    { skip: !open || !selectedCourse },
  );

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    if (quizId && detail.data?.data) {
      const row = detail.data.data;
      metaForm.reset({
        title: String(row.title ?? ""),
        description: String(row.description ?? ""),
        course: row.course && typeof row.course === "object" && "_id" in (row.course as object) ? String((row.course as { _id: unknown })._id) : String(row.course ?? ""),
        subject: String(row.subject ?? ""),
        minutes: Number(row.minutes ?? 30),
        passing: Number(row.passing ?? 40),
        negative: Boolean(row.negative),
        negativeValue: Number(row.negativeValue ?? 0.25),
      });
      setQuestions(Array.isArray(row.questions) ? (row.questions as QuizQuestion[]) : []);
    } else if (!quizId) {
      metaForm.reset({ minutes: 30, passing: 40, negative: false, negativeValue: 0.25, title: "", course: "", description: "", subject: "" });
      setQuestions([]);
    }
    setSelectedBank([]);
    setTab("manual");
  }, [open, quizId, detail.data, metaForm]);

  useEffect(() => {
    setSelectedBank([]);
  }, [selectedCourse]);

  const totalMarks = useMemo(() => questions.reduce((s, q) => s + (q.marks ?? 1), 0), [questions]);
  const bankRows = bank.data?.data ?? [];
  const alreadyAddedBankIds = useMemo(() => new Set(questions.map((q) => q.bankId).filter(Boolean)), [questions]);
  const saving = createState.isLoading || patchState.isLoading;

  async function saveQuiz(values: MetaForm) {
    if (questions.length === 0) {
      setFormError("Add at least one question manually or from the question bank.");
      setTab(questions.length === 0 && selectedCourse ? "bank" : "manual");
      return;
    }
    const body = { ...values, open: false, questions };
    try {
      if (quizId) {
        await patch({ resource: "quizzes", id: quizId, body }).unwrap();
        toast("Mock test updated");
      } else {
        await create({ resource: "quizzes", body }).unwrap();
        toast("Mock test created");
      }
      onSaved();
      onClose();
    } catch {
      toast("Save failed — check all fields and try again", "error");
    }
  }

  function addSelectedFromBank() {
    if (!selectedBank.length) {
      toast("Select at least one question", "error");
      return;
    }
    const picked = bankRows.filter((row) => selectedBank.includes(String(row._id)));
    const fresh = picked.filter((row) => !alreadyAddedBankIds.has(String(row._id)));
    if (!fresh.length) {
      toast("Selected questions are already in this test", "error");
      return;
    }
    setQuestions((prev) => [...prev, ...fresh.map(bankRowToQuestion)]);
    setSelectedBank([]);
    setFormError(null);
    toast(`${fresh.length} question(s) added to test`);
  }

  return (
    <Modal open={open} title={quizId ? "Edit mock test" : "New mock test"} onClose={onClose}>
      <form
        className="grid max-h-[78vh] gap-4 overflow-y-auto pr-1"
        noValidate
        onSubmit={metaForm.handleSubmit(
          (v) => void saveQuiz(v),
          () => setFormError("Fix the highlighted fields below."),
        )}
      >
        {formError ? (
          <p className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300" role="alert">
            {formError}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Title" error={metaForm.formState.errors.title?.message}>
            <Input {...metaForm.register("title")} />
          </Field>
          <Field label="Course" error={metaForm.formState.errors.course?.message}>
            <Select {...metaForm.register("course")}>
              <option value="">Select course</option>
              {(courses.data?.data ?? []).map((c) => (
                <option key={String(c._id)} value={String(c._id)}>{loc(c.title)}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Description"><Textarea {...metaForm.register("description")} /></Field>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Subject"><Input {...metaForm.register("subject")} /></Field>
          <Field label="Duration (min)" error={metaForm.formState.errors.minutes?.message}>
            <Input type="number" {...metaForm.register("minutes")} />
          </Field>
          <Field label="Passing %" error={metaForm.formState.errors.passing?.message}>
            <Input type="number" {...metaForm.register("passing")} />
          </Field>
          <Field label="Global negative" error={metaForm.formState.errors.negativeValue?.message}>
            <Input type="number" step="0.01" {...metaForm.register("negativeValue")} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...metaForm.register("negative")} className="accent-[#d4a22f]" />
          Enable global negative marking (when per-question negative is 0)
        </label>

        <div className="rounded border border-white/10 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-sans text-sm font-semibold">Questions ({questions.length}) · {totalMarks} marks</h3>
            <div className="flex gap-2">
              <Button type="button" variant={tab === "manual" ? "primary" : "ghost"} onClick={() => setTab("manual")}>Manual</Button>
              <Button type="button" variant={tab === "bank" ? "primary" : "ghost"} onClick={() => setTab("bank")}>From bank</Button>
            </div>
          </div>

          {tab === "manual" ? (
            <div className="grid gap-3 border-t border-white/5 pt-3">
              <Field label="Question" error={qForm.formState.errors.prompt?.message}>
                <Textarea {...qForm.register("prompt")} />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="A" error={qForm.formState.errors.optionA?.message}><Input {...qForm.register("optionA")} /></Field>
                <Field label="B" error={qForm.formState.errors.optionB?.message}><Input {...qForm.register("optionB")} /></Field>
                <Field label="C"><Input {...qForm.register("optionC")} /></Field>
                <Field label="D"><Input {...qForm.register("optionD")} /></Field>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <Field label="Correct idx"><Input type="number" {...qForm.register("answerIndex")} /></Field>
                <Field label="Marks"><Input type="number" step="0.25" {...qForm.register("marks")} /></Field>
                <Field label="Neg marks"><Input type="number" step="0.25" {...qForm.register("negativeMarks")} /></Field>
                <Field label="Difficulty"><Select {...qForm.register("difficulty")}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></Select></Field>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={qForm.handleSubmit(
                  (v) => {
                    setQuestions((prev) => [...prev, manualToQuestion(v)]);
                    qForm.reset({ marks: 1, negativeMarks: 0, difficulty: "medium", answerIndex: 0, prompt: "", optionA: "", optionB: "", optionC: "", optionD: "" });
                    setFormError(null);
                    toast("Question added to test");
                  },
                  () => toast("Fill in the manual question fields", "error"),
                )}
              >
                Add question to test
              </Button>
            </div>
          ) : (
            <div className="border-t border-white/5 pt-3">
              {!selectedCourse ? (
                <p className="text-sm text-amber-300/90">Select a course above to load questions from the bank for that course.</p>
              ) : bank.isLoading ? (
                <p className="text-sm text-zinc-400">Loading questions…</p>
              ) : bankRows.length === 0 ? (
                <p className="text-sm text-zinc-400">
                  No questions in the bank for this course. Add questions in the Question Bank tab or import Excel with this course selected.
                </p>
              ) : (
                <>
                  <p className="mb-2 text-xs text-zinc-500">
                    Showing {bankRows.length} question(s) for the selected course.
                  </p>
                  <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
                    {bankRows.map((row) => {
                      const id = String(row._id);
                      const added = alreadyAddedBankIds.has(id);
                      return (
                        <li key={id} className="flex gap-2 border-t border-white/5 pt-2">
                          <input
                            type="checkbox"
                            disabled={added}
                            checked={selectedBank.includes(id)}
                            onChange={(e) => {
                              setSelectedBank((prev) => (e.target.checked ? [...prev, id] : prev.filter((x) => x !== id)));
                            }}
                            className="mt-1 accent-[#d4a22f] disabled:opacity-40"
                          />
                          <span className={added ? "line-clamp-2 text-zinc-500" : "line-clamp-2"}>
                            {String(row.prompt)}
                            {added ? " (already added)" : ""}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <Button type="button" className="mt-3" variant="ghost" disabled={!selectedBank.length} onClick={addSelectedFromBank}>
                    Add selected ({selectedBank.length})
                  </Button>
                </>
              )}
            </div>
          )}

          <ExamQuestionList
            questions={questions}
            showNegativeMarks
            onRemove={(i) => setQuestions((prev) => prev.filter((_, j) => j !== i))}
            emptyLabel="No questions yet — add manually or from the bank."
          />
        </div>

        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : quizId ? "Update test" : "Create test"}
        </Button>
      </form>
    </Modal>
  );
}
