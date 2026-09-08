import * as XLSX from "xlsx";

export type ExternalImportRow = {
  serialNo?: number;
  studentName: string;
  batchTime?: string;
  address?: string;
  course?: string;
  admissionDate?: string;
  contactNo?: string;
  klic120?: string;
  klic60?: string;
  klic30?: string;
  installments: { amount?: number; date?: string }[];
  paidFees?: number;
  balanceFees?: number;
  totalFees?: number;
  sessionLabel?: string;
  programLabel?: string;
};

const TEMPLATE_HEADERS = [
  "sr_no",
  "student_name",
  "batch_time",
  "address",
  "course",
  "admission_date",
  "contact_no",
  "klic_120",
  "klic_60",
  "klic_30",
  "inst1_amount",
  "inst1_date",
  "inst2_amount",
  "inst2_date",
  "inst3_amount",
  "inst3_date",
  "inst4_amount",
  "inst4_date",
  "paid_fees",
  "balance_fees",
  "total_fees",
  "session_label",
  "program_label",
];

const EXAMPLE = [
  1,
  "VINAYAK PRALHAD MESHRAM",
  "10.00 AM",
  "DEORI",
  "MS-CIT",
  "01-09-2026",
  "8308052807",
  "KLiC Hardware",
  "",
  "",
  3000,
  "07/01",
  "",
  "",
  "",
  "",
  "",
  "",
  3000,
  2000,
  5000,
  "ADMISSION-2026",
  "MS-CIT + KLiC",
];

export function downloadExternalTemplate() {
  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, EXAMPLE]);
  XLSX.utils.book_append_sheet(wb, sheet, "Admissions");
  const instructions = XLSX.utils.aoa_to_sheet([
    ["Field", "Notes"],
    ["sr_no", "Serial number"],
    ["student_name", "Required"],
    ["batch_time", "e.g. 10.00 AM"],
    ["klic_120 / klic_60 / klic_30", "KLiC course name for that duration"],
    ["inst1_amount / inst1_date", "1st installment amount and date"],
    ["paid_fees / balance_fees / total_fees", "Numbers"],
  ]);
  XLSX.utils.book_append_sheet(wb, instructions, "Instructions");
  XLSX.writeFile(wb, "optech-external-admissions-template.xlsx");
}

function norm(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function toNumber(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  const cleaned = String(value).replace(/,/g, "").trim();
  if (!cleaned) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

function cell(row: unknown[], index: number) {
  return row[index] == null ? "" : String(row[index]).trim();
}

function mapFlatKey(key: string): keyof Omit<ExternalImportRow, "installments" | "studentName"> | "studentName" | "inst" | null {
  const k = norm(key);
  if (!k || k === "__empty" || k.startsWith("__")) return null;
  if (["sr_no", "sr", "serial_no", "serial", "sno"].includes(k)) return "serialNo";
  if (["student_name", "students_name", "name", "student"].includes(k)) return "studentName";
  if (["batch_time", "batch", "timing"].includes(k)) return "batchTime";
  if (k === "address") return "address";
  if (k === "course") return "course";
  if (["admission_date", "admission", "adm_date", "date_of_admission"].includes(k)) return "admissionDate";
  if (["contact_no", "contact", "phone", "mobile", "mobile_no"].includes(k)) return "contactNo";
  if (["klic_120", "120_hr", "120hr", "klic_120_hr"].includes(k)) return "klic120";
  if (["klic_60", "60_hr", "60hr", "klic_60_hr"].includes(k)) return "klic60";
  if (["klic_30", "30_hr", "30hr", "klic_30_hr"].includes(k)) return "klic30";
  if (["paid_fees", "paid", "paid_fee"].includes(k)) return "paidFees";
  if (["balance_fees", "balance", "balance_fee", "due"].includes(k)) return "balanceFees";
  if (["total_fees", "total", "total_fee", "fees"].includes(k)) return "totalFees";
  if (["session_label", "session", "admission_year"].includes(k)) return "sessionLabel";
  if (["program_label", "program"].includes(k)) return "programLabel";
  if (k.includes("inst") || k.includes("1st") || k.includes("2nd") || k.includes("3rd") || k.includes("4th") || k === "date") {
    return "inst";
  }
  return null;
}

function buildHeaderMap(headerRow: unknown[], subRow?: unknown[]) {
  const map: { index: number; field: string }[] = [];
  let lastInst = 0;
  for (let i = 0; i < headerRow.length; i++) {
    const top = norm(headerRow[i]);
    const sub = norm(subRow?.[i] ?? "");
    const combined = sub || top;

    if (["120_hr", "120hr", "klic_120"].includes(combined) || (top.includes("klic") && combined.includes("120"))) {
      map.push({ index: i, field: "klic120" });
      continue;
    }
    if (["60_hr", "60hr", "klic_60"].includes(combined) || (top.includes("klic") && combined.includes("60"))) {
      map.push({ index: i, field: "klic60" });
      continue;
    }
    if (["30_hr", "30hr", "klic_30"].includes(combined) || (top.includes("klic") && combined.includes("30"))) {
      map.push({ index: i, field: "klic30" });
      continue;
    }

    if (["1st", "first", "inst1", "inst1_amount"].includes(combined) || combined === "1st_amount") {
      lastInst = 1;
      map.push({ index: i, field: "inst1_amount" });
      continue;
    }
    if (["2nd", "second", "inst2", "inst2_amount"].includes(combined)) {
      lastInst = 2;
      map.push({ index: i, field: "inst2_amount" });
      continue;
    }
    if (["3rd", "third", "inst3", "inst3_amount"].includes(combined)) {
      lastInst = 3;
      map.push({ index: i, field: "inst3_amount" });
      continue;
    }
    if (["4th", "fourth", "inst4", "inst4_amount"].includes(combined)) {
      lastInst = 4;
      map.push({ index: i, field: "inst4_amount" });
      continue;
    }
    if (combined === "date" || combined.endsWith("_date")) {
      if (lastInst >= 1 && lastInst <= 4) {
        map.push({ index: i, field: `inst${lastInst}_date` });
      }
      continue;
    }

    const flat = mapFlatKey(combined || top);
    if (flat && flat !== "inst") map.push({ index: i, field: flat });
  }
  return map;
}

function rowFromMap(row: unknown[], map: { index: number; field: string }[]): ExternalImportRow | null {
  const out: ExternalImportRow = {
    studentName: "",
    installments: [{}, {}, {}, {}],
  };

  for (const { index, field } of map) {
    const raw = row[index];
    const text = cell(row, index);
    if (!text && raw !== 0) continue;

    if (field === "serialNo") out.serialNo = toNumber(raw);
    else if (field === "studentName") out.studentName = text;
    else if (field === "batchTime") out.batchTime = text;
    else if (field === "address") out.address = text;
    else if (field === "course") out.course = text;
    else if (field === "admissionDate") out.admissionDate = text;
    else if (field === "contactNo") out.contactNo = text;
    else if (field === "klic120") out.klic120 = text;
    else if (field === "klic60") out.klic60 = text;
    else if (field === "klic30") out.klic30 = text;
    else if (field === "paidFees") out.paidFees = toNumber(raw);
    else if (field === "balanceFees") out.balanceFees = toNumber(raw);
    else if (field === "totalFees") out.totalFees = toNumber(raw);
    else if (field === "sessionLabel") out.sessionLabel = text;
    else if (field === "programLabel") out.programLabel = text;
    else if (/^inst([1-4])_amount$/.test(field)) {
      const n = Number(field.match(/^inst([1-4])_amount$/)?.[1] ?? 1) - 1;
      out.installments[n] = { ...out.installments[n], amount: toNumber(raw) };
    } else if (/^inst([1-4])_date$/.test(field)) {
      const n = Number(field.match(/^inst([1-4])_date$/)?.[1] ?? 1) - 1;
      out.installments[n] = { ...out.installments[n], date: text };
    }
  }

  if (!out.studentName) return null;
  return out;
}

function parseMatrix(matrix: unknown[][]): ExternalImportRow[] {
  if (!matrix.length) return [];

  let headerIdx = -1;
  for (let i = 0; i < Math.min(matrix.length, 12); i++) {
    const joined = matrix[i].map((c) => norm(c)).join(" ");
    if (joined.includes("student") || joined.includes("sr_no") || joined.includes("admission_date")) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) headerIdx = 0;

  const headerRow = matrix[headerIdx] ?? [];
  const maybeSub = matrix[headerIdx + 1] ?? [];
  const subLooksLikeHeaders = maybeSub.some((c) => {
    const n = norm(c);
    return ["120_hr", "60_hr", "30_hr", "1st", "2nd", "3rd", "4th", "date"].includes(n);
  });

  const map = buildHeaderMap(headerRow, subLooksLikeHeaders ? maybeSub : undefined);
  const dataStart = headerIdx + (subLooksLikeHeaders ? 2 : 1);
  const rows: ExternalImportRow[] = [];

  for (let i = dataStart; i < matrix.length; i++) {
    const row = matrix[i] ?? [];
    if (!row.some((c) => String(c ?? "").trim())) continue;
    const parsed = rowFromMap(row, map);
    if (parsed) rows.push(parsed);
  }
  return rows;
}

export function parseExternalImportFile(file: File): Promise<{
  rows: ExternalImportRow[];
  programLabel?: string;
  sessionLabel?: string;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = new Uint8Array(reader.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array", cellDates: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false }) as unknown[][];

        let programLabel: string | undefined;
        let sessionLabel: string | undefined;
        const top = (matrix[0] ?? []).map((c) => String(c ?? "").trim()).filter(Boolean);
        if (top[0]) programLabel = top[0];
        if (top[1]) sessionLabel = top[1];
        if (!sessionLabel) {
          const found = top.find((t) => /admission|202\d/i.test(t));
          if (found) sessionLabel = found;
        }

        const rows = parseMatrix(matrix);
        resolve({ rows, programLabel, sessionLabel });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsArrayBuffer(file);
  });
}
