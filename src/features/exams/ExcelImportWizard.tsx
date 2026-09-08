import { useState } from "react";
import { Button } from "@/components/Button";
import { Field, Input, Select } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { useActionMutation } from "@/app/api";
import { toast } from "@/components/Toast";
import { parseImportFile, type ImportRowRecord } from "./utils/quizExcel";
import { useListQuery } from "@/app/api";
import { loc } from "@/utils/format";

type ValidRow = { row: number; valid: boolean; errors: string[]; data?: Record<string, unknown> };
type ValidateResult = { valid: ValidRow[]; invalid: ValidRow[]; summary: { total: number; validCount: number; invalidCount: number } };

export function ExcelImportWizard({
  open,
  onClose,
  onDone,
  defaultCourse = "",
  defaultSubject = "",
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  defaultCourse?: string;
  defaultSubject?: string;
}) {
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [fileName, setFileName] = useState("");
  const [course, setCourse] = useState(defaultCourse);
  const [subject, setSubject] = useState(defaultSubject);
  const [result, setResult] = useState<ValidateResult | null>(null);
  const [act, actState] = useActionMutation();
  const courses = useListQuery({ resource: "courses", page: 1 });

  function reset() {
    setStep("upload");
    setFileName("");
    setResult(null);
    setCourse(defaultCourse);
    setSubject(defaultSubject);
  }

  async function handleFile(file: File) {
    try {
      const rows: ImportRowRecord[] = await parseImportFile(file);
      if (!rows.length) {
        toast("No data rows found", "error");
        return;
      }
      setFileName(file.name);
      const body = await act({
        path: "question-bank/import/validate",
        body: { rows },
      }).unwrap();
      setResult(body.data as ValidateResult);
      setStep("preview");
    } catch {
      toast("Could not parse file", "error");
    }
  }

  async function confirmImport() {
    if (!result?.valid.length) return;
    try {
      const res = await act({
        path: "question-bank/import/confirm",
        body: { rows: result.valid, course: course || undefined, subject: subject || undefined },
      }).unwrap();
      const imported = Number((res.data as { imported?: number })?.imported ?? 0);
      toast(`${imported} question(s) imported`);
      setStep("done");
      onDone();
    } catch {
      toast("Import failed", "error");
    }
  }

  return (
    <Modal
      open={open}
      title="Import questions from Excel"
      onClose={() => {
        reset();
        onClose();
      }}
    >
      {step === "upload" ? (
        <div className="grid gap-4">
          <p className="text-sm text-zinc-400">Upload the filled template. Rows are validated before anything is saved.</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Course (optional)">
              <Select value={course} onChange={(e) => setCourse(e.target.value)}>
                <option value="">None</option>
                {(courses.data?.data ?? []).map((c) => (
                  <option key={String(c._id)} value={String(c._id)}>{loc(c.title)}</option>
                ))}
              </Select>
            </Field>
            <Field label="Subject (optional)"><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
          </div>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
        </div>
      ) : null}

      {step === "preview" && result ? (
        <div className="grid gap-4">
          <p className="text-sm text-zinc-300">
            File: <span className="text-zinc-100">{fileName}</span> · {result.summary.validCount} valid · {result.summary.invalidCount} invalid
          </p>
          {result.invalid.length > 0 ? (
            <div className="max-h-40 overflow-y-auto rounded border border-red-500/30 bg-red-500/5 p-3 text-xs">
              <p className="mb-2 font-mono uppercase text-red-300">Invalid rows</p>
              <ul className="space-y-1">
                {result.invalid.map((r) => (
                  <li key={r.row}>Row {r.row}: {r.errors.join("; ")}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {result.valid.length > 0 ? (
            <div className="max-h-48 overflow-y-auto rounded border border-white/10 p-3 text-xs">
              <p className="mb-2 font-mono uppercase text-zinc-500">Valid preview (first 5)</p>
              <ul className="space-y-2">
                {result.valid.slice(0, 5).map((r) => (
                  <li key={r.row} className="border-t border-white/5 pt-2">
                    Row {r.row}: {String(r.data?.prompt ?? "")}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setStep("upload")}>Back</Button>
            <Button type="button" disabled={!result.valid.length || actState.isLoading} onClick={() => void confirmImport()}>
              {actState.isLoading ? "Importing…" : `Confirm import (${result.valid.length})`}
            </Button>
          </div>
        </div>
      ) : null}

      {step === "done" ? (
        <div className="grid gap-3">
          <p className="text-sm text-zinc-300">Import complete.</p>
          <Button type="button" onClick={() => { reset(); onClose(); }}>Close</Button>
        </div>
      ) : null}
    </Modal>
  );
}
