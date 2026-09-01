import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/Button";
import { Field, Input, Select, Textarea } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { useCreateMutation, useGetByIdQuery, usePatchMutation } from "@/app/api";
import { toast } from "@/components/Toast";
import { downloadImportTemplate } from "@/features/quizzes/utils/quizExcel";
import { ExamQuestionList } from "@/components/ExamQuestionList";
import { ScholarshipExcelImport, type ImportedQuestion } from "./ScholarshipExcelImport";

const metaSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters"),
  description: z.string().optional(),
  minutes: z.coerce.number().min(1, "Duration must be at least 1 minute"),
  minA: z.coerce.number().min(0).max(100),
  pctA: z.coerce.number().min(0).max(100),
  minB: z.coerce.number().min(0).max(100),
  pctB: z.coerce.number().min(0).max(100),
});

const qSchema = z.object({
  prompt: z.string().min(4, "Question must be at least 4 characters"),
  optionA: z.string().min(1, "Option A is required"),
  optionB: z.string().min(1, "Option B is required"),
  optionC: z.string().optional(),
  optionD: z.string().optional(),
  answerIndex: z.coerce.number().min(0).max(3),
  marks: z.coerce.number().min(0),
  difficulty: z.enum(["easy", "medium", "hard"]),
});

type MetaForm = z.infer<typeof metaSchema>;
type QuestionForm = z.infer<typeof qSchema>;
type ExamQuestion = ImportedQuestion;

function manualToQuestion(values: QuestionForm): ExamQuestion {
  const options = [values.optionA, values.optionB, values.optionC, values.optionD].filter(Boolean) as string[];
  return {
    type: "mcq",
    prompt: values.prompt,
    options,
    answerIndex: Math.min(values.answerIndex, options.length - 1),
    marks: values.marks,
    difficulty: values.difficulty,
  };
}

export function ScholarshipEditorModal({
  open,
  examId,
  onClose,
  onSaved,
}: {
  open: boolean;
  examId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const detail = useGetByIdQuery({ resource: "scholarships", id: examId ?? "" }, { skip: !examId });
  const [create, createState] = useCreateMutation();
  const [patch, patchState] = usePatchMutation();
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [tab, setTab] = useState<"manual" | "excel">("manual");
  const [importOpen, setImportOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const metaForm = useForm<MetaForm>({
    resolver: zodResolver(metaSchema),
    defaultValues: { minutes: 30, minA: 90, pctA: 20, minB: 75, pctB: 10 },
  });
  const qForm = useForm<QuestionForm>({
    resolver: zodResolver(qSchema),
    defaultValues: { marks: 1, difficulty: "medium", answerIndex: 0 },
  });

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    if (examId && detail.data?.data) {
      const row = detail.data.data;
      const slabs = (row.slabs as { minPercent?: number; couponPercent?: number }[]) ?? [];
      metaForm.reset({
        title: String(row.title ?? ""),
        description: String(row.description ?? ""),
        minutes: Number(row.minutes ?? 30),
        minA: Number(slabs[0]?.minPercent ?? 90),
        pctA: Number(slabs[0]?.couponPercent ?? 20),
        minB: Number(slabs[1]?.minPercent ?? 75),
        pctB: Number(slabs[1]?.couponPercent ?? 10),
      });
      setQuestions(Array.isArray(row.questions) ? (row.questions as ExamQuestion[]) : []);
    } else if (!examId) {
      metaForm.reset({ minutes: 30, minA: 90, pctA: 20, minB: 75, pctB: 10, title: "", description: "" });
      setQuestions([]);
    }
    setTab("manual");
  }, [open, examId, detail.data, metaForm]);

  const totalMarks = useMemo(() => questions.reduce((s, q) => s + (q.marks ?? 1), 0), [questions]);
  const saving = createState.isLoading || patchState.isLoading;

  async function saveExam(values: MetaForm) {
    if (questions.length === 0) {
      setFormError("Add at least one question manually or via Excel import.");
      return;
    }
    const body = {
      title: values.title,
      description: values.description,
      minutes: values.minutes,
      active: false,
      slabs: [
        { minPercent: values.minA, couponPercent: values.pctA, couponPrefix: "SCH" },
        { minPercent: values.minB, couponPercent: values.pctB, couponPrefix: "SCH" },
      ],
      questions,
    };
    try {
      if (examId) {
        await patch({ resource: "scholarships", id: examId, body }).unwrap();
        toast("Exam updated");
      } else {
        await create({ resource: "scholarships", body }).unwrap();
        toast("Exam created");
      }
      onSaved();
      onClose();
    } catch {
      toast("Save failed", "error");
    }
  }

  return (
    <>
      <Modal open={open} title={examId ? "Edit scholarship exam" : "New scholarship exam"} onClose={onClose}>
        <form
          className="grid max-h-[78vh] gap-4 overflow-y-auto pr-1"
          noValidate
          onSubmit={metaForm.handleSubmit(
            (v) => void saveExam(v),
            () => setFormError("Fix the highlighted fields below."),
          )}
        >
          {formError ? <p className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{formError}</p> : null}
          <Field label="Title" error={metaForm.formState.errors.title?.message}><Input {...metaForm.register("title")} /></Field>
          <Field label="Description"><Textarea {...metaForm.register("description")} /></Field>
          <Field label="Duration (min)" error={metaForm.formState.errors.minutes?.message}><Input type="number" {...metaForm.register("minutes")} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Slab A min %" error={metaForm.formState.errors.minA?.message}><Input type="number" {...metaForm.register("minA")} /></Field>
            <Field label="Slab A coupon %" error={metaForm.formState.errors.pctA?.message}><Input type="number" {...metaForm.register("pctA")} /></Field>
            <Field label="Slab B min %" error={metaForm.formState.errors.minB?.message}><Input type="number" {...metaForm.register("minB")} /></Field>
            <Field label="Slab B coupon %" error={metaForm.formState.errors.pctB?.message}><Input type="number" {...metaForm.register("pctB")} /></Field>
          </div>

          <div className="rounded border border-white/10 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-sans text-sm font-semibold">Questions ({questions.length}) · {totalMarks} marks</h3>
              <div className="flex gap-2">
                <Button type="button" variant={tab === "manual" ? "primary" : "ghost"} onClick={() => setTab("manual")}>Manual</Button>
                <Button type="button" variant={tab === "excel" ? "primary" : "ghost"} onClick={() => setTab("excel")}>Excel</Button>
              </div>
            </div>
            {tab === "manual" ? (
              <div className="grid gap-3 border-t border-white/5 pt-3">
                <Field label="Question" error={qForm.formState.errors.prompt?.message}><Textarea {...qForm.register("prompt")} /></Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="A" error={qForm.formState.errors.optionA?.message}><Input {...qForm.register("optionA")} /></Field>
                  <Field label="B" error={qForm.formState.errors.optionB?.message}><Input {...qForm.register("optionB")} /></Field>
                  <Field label="C"><Input {...qForm.register("optionC")} /></Field>
                  <Field label="D"><Input {...qForm.register("optionD")} /></Field>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Field label="Correct idx"><Input type="number" {...qForm.register("answerIndex")} /></Field>
                  <Field label="Marks"><Input type="number" {...qForm.register("marks")} /></Field>
                  <Field label="Difficulty"><Select {...qForm.register("difficulty")}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></Select></Field>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={qForm.handleSubmit((v) => {
                    setQuestions((prev) => [...prev, manualToQuestion(v)]);
                    qForm.reset({ marks: 1, difficulty: "medium", answerIndex: 0, prompt: "", optionA: "", optionB: "", optionC: "", optionD: "" });
                    setFormError(null);
                    toast("Question added");
                  }, () => toast("Fill manual question fields", "error"))}
                >
                  Add question
                </Button>
              </div>
            ) : (
              <div className="border-t border-white/5 pt-3">
                <Button type="button" variant="ghost" onClick={() => downloadImportTemplate()}>Download template</Button>
                <Button type="button" className="ml-2" variant="ghost" onClick={() => setImportOpen(true)}>Upload Excel</Button>
              </div>
            )}
            <ExamQuestionList
              questions={questions}
              onRemove={(i) => setQuestions((prev) => prev.filter((_, j) => j !== i))}
              emptyLabel="No questions yet."
            />
          </div>
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : examId ? "Update exam" : "Create exam"}</Button>
        </form>
      </Modal>
      <ScholarshipExcelImport
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={(qs) => { setQuestions((prev) => [...prev, ...qs]); setFormError(null); }}
      />
    </>
  );
}
