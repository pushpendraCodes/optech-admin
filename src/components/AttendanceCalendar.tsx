import { useEffect, useMemo, useState } from "react";
import { loc } from "@/utils/format";
import { photoUrl } from "@/components/StudentPhoto";

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

function timeLabel(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function entryPhotos(entry: Record<string, unknown>) {
  const login = photoUrl(entry.loginPhoto);
  const logout = photoUrl(entry.logoutPhoto);
  return {
    login,
    logout,
    loginAt: timeLabel(entry.loginAt),
    logoutAt: timeLabel(entry.logoutAt),
  };
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
  const [preview, setPreview] = useState<{ url: string; label: string } | null>(null);

  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPreview(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview]);

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
            <div key={`empty-${index}`} className="min-h-16 rounded-xl border border-transparent" />
          ) : (
            <div
              key={cell.key}
              role={onDayClick ? "button" : undefined}
              tabIndex={onDayClick ? 0 : undefined}
              title={
                cell.entries?.length
                  ? cell.entries
                      .map((entry) => `${courseName(entry.course)}: ${String(entry.status)}`)
                      .join("\n")
                  : "No attendance"
              }
              onClick={() => cell.key && onDayClick?.(cell.key)}
              onKeyDown={(e) => {
                if (!onDayClick || !cell.key) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onDayClick(cell.key);
                }
              }}
              className={`min-h-16 rounded-xl border p-2 text-left transition hover:ring-1 hover:ring-accent/40 ${
                cell.status ? tone[cell.status] : "border-white/10 bg-white/5 text-zinc-500"
              } ${selectedDate === cell.key ? "ring-2 ring-accent" : ""} ${onDayClick ? "cursor-pointer" : ""}`}
            >
              <p className="font-mono text-xs">{cell.day}</p>
              {cell.status ? (
                <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em]">{cell.status}</p>
              ) : null}
              {cell.entries?.length ? (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {cell.entries.map((entry, entryIndex) => {
                    const photos = entryPhotos(entry);
                    if (!photos.login && !photos.logout) return null;
                    return (
                      <span key={String(entry._id ?? `${cell.key}-${entryIndex}`)} className="flex gap-1">
                        {photos.login ? (
                          <button
                            type="button"
                            title={`Login${photos.loginAt ? ` · ${photos.loginAt}` : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreview({ url: photos.login, label: `Login${photos.loginAt ? ` · ${photos.loginAt}` : ""}` });
                            }}
                            className="h-8 w-8 overflow-hidden rounded-lg border border-white/20 bg-black/30"
                          >
                            <img src={photos.login} alt="Login attendance" className="h-full w-full object-cover" />
                          </button>
                        ) : null}
                        {photos.logout ? (
                          <button
                            type="button"
                            title={`Logout${photos.logoutAt ? ` · ${photos.logoutAt}` : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreview({
                                url: photos.logout,
                                label: `Logout${photos.logoutAt ? ` · ${photos.logoutAt}` : ""}`,
                              });
                            }}
                            className="h-8 w-8 overflow-hidden rounded-lg border border-white/20 bg-black/30"
                          >
                            <img src={photos.logout} alt="Logout attendance" className="h-full w-full object-cover" />
                          </button>
                        ) : null}
                      </span>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ),
        )}
      </div>
      <p className="mt-3 text-center font-sans text-sm text-zinc-400">
        {MONTHS[month - 1]} {year}
      </p>

      {preview ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-black/80 backdrop-blur-sm" aria-label="Close photo" onClick={() => setPreview(null)} />
          <figure className="relative z-10 max-h-[90vh] w-full max-w-3xl">
            <img src={preview.url} alt={preview.label} className="max-h-[80vh] w-full rounded-2xl object-contain" />
            <figcaption className="mt-3 text-center font-mono text-xs uppercase tracking-[0.16em] text-zinc-300">
              {preview.label}
            </figcaption>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="mx-auto mt-3 block rounded-full border border-white/15 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-white"
            >
              Close
            </button>
          </figure>
        </div>
      ) : null}
    </div>
  );
}

export function monthYearOptions() {
  const now = new Date();
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);
  return { years, months: MONTHS.map((label, index) => ({ value: index + 1, label })) };
}
