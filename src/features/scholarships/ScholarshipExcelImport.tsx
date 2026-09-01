import { useState } from "react";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { useActionMutation } from "@/app/api";
import { toast } from "@/components/Toast";
import { parseImportFile } from "@/features/quizzes/utils/quizExcel";

type ValidRow = { row: number; valid: boolean; errors: string[]; data?: Record<string, unknown> };
type ValidateResult = { valid: ValidRow[]; invalid: ValidRow[]; summary: { total: number; validCount: number; invalidCount: number } };

export type ImportedQuestion = {
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
};

function rowToQuestion(data: Record<string, unknown>): ImportedQuestion {
  return {
    type: "mcq",
    prompt: String(data.prompt ?? ""),
    options: Array.isArray(data.options) ? data.options.map(String) : [],
    answerIndex: Number(data.answerIndex ?? 0),
    marks: Number(data.marks ?? 1),
    negativeMarks: Number(data.negativeMarks ?? 0),
    difficulty: String(data.difficulty ?? "medium"),
    explanation: data.explanation ? String(data.explanation) : undefined,
    topic: data.topic ? String(data.topic) : undefined,
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
  };
}

export function ScholarshipExcelImport({
  open,
  onClose,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (questions: ImportedQuestion[]) => void;
}) {
  const [step, setStep] = useState<"upload" | "preview">("upload");
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<ValidateResult | null>(null);
  const [act, actState] = useActionMutation();

  function reset() {
    setStep("upload");
    setFileName("");
    setResult(null);
  }

  async function handleFile(file: File) {
    try {
      const rows = await parseImportFile(file);
      if (!rows.length) {
        toast("No data rows found", "error");
        return;
      }
      setFileName(file.name);
      const body = await act({ path: "scholarships/import/validate", body: { rows } }).unwrap();
      setResult(body.data as ValidateResult);
      setStep("preview");
    } catch {
      toast("Could not parse file", "error");
    }
  }

  function confirmImport() {
    if (!result?.valid.length) return;
    const questions = result.valid.filter((r) => r.data).map((r) => rowToQuestion(r.data!));
    onImport(questions);
    toast(`${questions.length} question(s) added`);
    reset();
    onClose();
  }

  return (
    <Modal open={open} title="Import questions from Excel" onClose={() => { reset(); onClose(); }}>
      {step === "upload" ? (
        <div className="grid gap-4">
          <p className="text-sm text-zinc-400">Upload the same template used for quiz question import.</p>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }} />
        </div>
      ) : null}
      {step === "preview" && result ? (
        <div className="grid gap-4">
          <p className="text-sm text-zinc-300">
            {fileName} · {result.summary.validCount} valid · {result.summary.invalidCount} invalid
          </p>
          {result.invalid.length > 0 ? (
            <div className="max-h-32 overflow-y-auto rounded border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-200">
              {result.invalid.map((r) => (<div key={r.row}>Row {r.row}: {r.errors.join("; ")}</div>))}
            </div>
          ) : null}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setStep("upload")}>Back</Button>
            <Button type="button" disabled={!result.valid.length || actState.isLoading} onClick={confirmImport}>
              Add {result.valid.length} to exam
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
