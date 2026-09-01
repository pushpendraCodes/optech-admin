import { useMemo } from "react";
import { loc } from "@/utils/format";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

type Mark = "present" | "absent" | "late";

const tone: Record<Mark, string> = {
  present: "border-success/40 bg-success/15 text-success",
  absent: "border-danger/40 bg-danger/15 text-danger",
  late: "border-warning/40 bg-warning/15 text-warning",
};

function dateKey(value: unknown) {
  return new Date(String(value)).toISOString().slice(0, 10);
}

function dominantStatus(rows: Record<string, unknown>[]): Mark | null {
  if (!rows.length) return null;
  if (rows.some((r) => r.status === "absent")) return "absent";
  if (rows.some((r) => r.status === "late")) return "late";
  return "present";
}

function courseName(course: unknown) {
  if (course && typeof course === "object" && "title" in (course as object)) return loc((course as { title: unknown }).title);
  return "Course";
}

export function AttendanceCalendar({
  year,
  month,
  rows,
  selectedDate,
  onDayClick,
}: {
  year: number;
  month: number;
  rows: Record<string, unknown>[];
  selectedDate?: string;
  onDayClick?: (dateKey: string) => void;
}) {
  const byDay = useMemo(() => {
    const map = new Map<string, Record<string, unknown>[]>();
    for (const row of rows) {
      const key = dateKey(row.date);
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return map;
  }, [rows]);

  const cells = useMemo(() => {
    const totalDays = new Date(year, month, 0).getDate();
    const offset = new Date(year, month - 1, 1).getDay();
    const items: Array<{ day: number | null; key?: string; status?: Mark | null; entries?: Record<string, unknown>[] }> = [];
    for (let i = 0; i < offset; i += 1) items.push({ day: null });
    for (let day = 1; day <= totalDays; day += 1) {
      const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const entries = byDay.get(key) ?? [];
      items.push({ day, key, status: dominantStatus(entries), entries });
    }
    return items;
  }, [byDay, month, year]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-3 text-xs text-zinc-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-success/40 bg-success/15" /> Present
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-warning/40 bg-warning/15" /> Late
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-danger/40 bg-danger/15" /> Absent
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-white/10 bg-white/5" /> Not marked
        </span>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {WEEKDAYS.map((label) => (
          <div key={label} className="pb-1 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
            {label}
          </div>
        ))}
        {cells.map((cell, index) =>
          cell.day == null ? (
            <div key={`empty-${index}`} className="min-h-14 rounded-xl border border-transparent" />
          ) : (
            <button
              key={cell.key}
              type="button"
              title={
                cell.entries?.length
                  ? cell.entries
                      .map((entry) => `${courseName(entry.course)}: ${String(entry.status)}`)
                      .join("\n")
                  : "No attendance"
              }
              onClick={() => cell.key && onDayClick?.(cell.key)}
              className={`min-h-14 rounded-xl border p-2 text-left transition hover:ring-1 hover:ring-accent/40 ${
                cell.status ? tone[cell.status] : "border-white/10 bg-white/5 text-zinc-500"
              } ${selectedDate === cell.key ? "ring-2 ring-accent" : ""}`}
            >
              <p className="font-mono text-xs">{cell.day}</p>
              {cell.status ? (
                <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em]">{cell.status}</p>
              ) : null}
              {cell.entries?.length ? (
                <p className="mt-1 font-mono text-[9px] text-zinc-400">{cell.entries.length} marked</p>
              ) : null}
            </button>
          ),
        )}
      </div>
      <p className="mt-3 text-center font-sans text-sm text-zinc-400">
        {MONTHS[month - 1]} {year}
      </p>
    </div>
  );
}

export function monthYearOptions() {
  const now = new Date();
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);
  return { years, months: MONTHS.map((label, index) => ({ value: index + 1, label })) };
}
