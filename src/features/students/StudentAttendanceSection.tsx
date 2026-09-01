import { useMemo, useState } from "react";
import { Select } from "@/components/Field";
import { Skeleton, StatCard } from "@/components/Chrome";
import { AttendanceCalendar, monthYearOptions } from "@/components/AttendanceCalendar";
import { useListQuery } from "@/app/api";
import { loc } from "@/utils/format";

function courseId(course: unknown) {
  if (course && typeof course === "object" && "_id" in (course as object)) return String((course as { _id: unknown })._id);
  return course ? String(course) : "";
}

export function StudentAttendanceSection({
  studentId,
  enrollments,
}: {
  studentId: string;
  enrollments: Record<string, unknown>[];
}) {
  const now = new Date();
  const { years, months } = monthYearOptions();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [courseIdFilter, setCourseIdFilter] = useState("");

  const courseOptions = useMemo(() => {
    const seen = new Set<string>();
    return enrollments
      .map((row) => {
        const id = courseId(row.course);
        if (!id || seen.has(id)) return null;
        seen.add(id);
        return { id, title: loc((row.course as { title?: unknown } | undefined)?.title) || id };
      })
      .filter(Boolean) as { id: string; title: string }[];
  }, [enrollments]);

  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const { data, isLoading } = useListQuery(
    {
      resource: "attendance",
      page: 1,
      extra: { studentId, month: monthKey, courseId: courseIdFilter },
    },
    { skip: !studentId },
  );

  const rows = data?.data ?? [];
  const counts = useMemo(() => {
    const next = { present: 0, absent: 0, late: 0 };
    for (const row of rows) {
      const status = String(row.status);
      if (status === "present") next.present += 1;
      else if (status === "absent") next.absent += 1;
      else if (status === "late") next.late += 1;
    }
    return next;
  }, [rows]);
  const total = counts.present + counts.absent + counts.late;
  const percent = total ? Math.round((counts.present / total) * 100) : 0;

  return (
    <article className="card mt-4 p-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-sans text-lg font-semibold">Attendance calendar</h2>
          <p className="mt-1 text-sm text-zinc-500">Filter by month, year, and course.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">Month</span>
            <Select value={String(month)} onChange={(e) => setMonth(Number(e.target.value))}>
              {months.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">Year</span>
            <Select value={String(year)} onChange={(e) => setYear(Number(e.target.value))}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">Course</span>
            <Select value={courseIdFilter} onChange={(e) => setCourseIdFilter(e.target.value)}>
              <option value="">All courses</option>
              {courseOptions.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <StatCard label="Present" value={counts.present} />
        <StatCard label="Absent" value={counts.absent} />
        <StatCard label="Late" value={counts.late} />
        <StatCard label="This month" value={`${percent}%`} />
      </div>

      {isLoading ? (
        <Skeleton className="h-72" />
      ) : (
        <AttendanceCalendar year={year} month={month} rows={rows} />
      )}
    </article>
  );
}
