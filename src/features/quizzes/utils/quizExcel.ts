import * as XLSX from "xlsx";

export const IMPORT_COLUMNS = [
  "question",
  "option_a",
  "option_b",
  "option_c",
  "option_d",
  "correct_answer",
  "marks",
  "negative_marks",
  "difficulty",
  "explanation",
  "topic",
  "tags",
] as const;

export type ImportRowRecord = Record<(typeof IMPORT_COLUMNS)[number], string>;

const INSTRUCTIONS = [
  ["Field", "Required", "Allowed values / notes"],
  ["question", "Yes", "The question text"],
  ["option_a", "Yes", "First option"],
  ["option_b", "Yes", "Second option"],
  ["option_c", "No", "Third option"],
  ["option_d", "No", "Fourth option"],
  ["correct_answer", "Yes", "A, B, C, D or 0–3 (index)"],
  ["marks", "No", "Default 1. Non-negative number"],
  ["negative_marks", "No", "Default 0. Deducted when wrong"],
  ["difficulty", "No", "Easy, Medium, or Hard (default Medium)"],
  ["explanation", "No", "Shown after submission (optional)"],
  ["topic", "No", "Topic label for filtering"],
  ["tags", "No", "Comma-separated tags, e.g. react,frontend"],
];

const EXAMPLE: ImportRowRecord = {
  question: "What is React?",
  option_a: "JavaScript Library",
  option_b: "Database",
  option_c: "OS",
  option_d: "Language",
  correct_answer: "A",
  marks: "1",
  negative_marks: "0.25",
  difficulty: "Easy",
  explanation: "React is a JS library",
  topic: "React Basics",
  tags: "react,frontend",
};

export function downloadImportTemplate() {
  const wb = XLSX.utils.book_new();
  const questions = XLSX.utils.aoa_to_sheet([[...IMPORT_COLUMNS], IMPORT_COLUMNS.map((c) => EXAMPLE[c])]);
  const instructions = XLSX.utils.aoa_to_sheet(INSTRUCTIONS);
  XLSX.utils.book_append_sheet(wb, questions, "Questions");
  XLSX.utils.book_append_sheet(wb, instructions, "Instructions");
  XLSX.writeFile(wb, "optech-question-import-template.xlsx");
}

function normalizeKey(key: string) {
  return key.trim().toLowerCase().replace(/\s+/g, "_");
}

export function parseImportFile(file: File): Promise<ImportRowRecord[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = new Uint8Array(reader.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
        const rows = raw.map((row) => {
          const mapped: Record<string, string> = {};
          Object.entries(row).forEach(([k, v]) => {
            mapped[normalizeKey(k)] = String(v ?? "").trim();
          });
          const out = {} as ImportRowRecord;
          IMPORT_COLUMNS.forEach((col) => {
            out[col] = mapped[col] ?? "";
          });
          return out;
        });
        resolve(rows.filter((r) => r.question.trim() !== ""));
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}
