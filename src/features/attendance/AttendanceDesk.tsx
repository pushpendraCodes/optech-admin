import { useEffect, useMemo, useState } from "react";
import { PageHeader, EmptyState, Skeleton, StatCard } from "@/components/Chrome";
import { Button } from "@/components/Button";
import { Input, Select } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { AttendanceCalendar, monthYearOptions } from "@/components/AttendanceCalendar";
import { StudentAvatar } from "@/components/StudentPhoto";
import { useActionMutation, useListQuery, usePatchMutation } from "@/app/api";
import { toast } from "@/components/Toast";
import { useCan } from "@/hooks/useAuth";
import { loc } from "@/utils/format";

type Mark = "present" | "absent" | "late";

function studentRefId(row: Record<string, unknown>) {
  const student = row.student;
  if (student && typeof student === "object" && "_id" in (student as object)) return String((student as { _id: unknown })._id);
  return student ? String(student) : "";
}

function nameFromStudentRow(row: Record<string, unknown>) {
  const user = row.user as { name?: string } | undefined;
  return user?.name ?? String(row.studentCode ?? "Student");
}

export function AttendanceDesk() {
  const canWrite = useCan("attendance:write");
  const now = new Date();
  const { years, months } = monthYearOptions();
  const [courseId, setCourseId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [date, setDate] = useState(now.toISOString().slice(0, 10));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [editRecord, setEditRecord] = useState<Record<string, unknown> | null>(null);

  const courses = useListQuery({ resource: "courses", page: 1 });
  const batches = useListQuery({ resource: "batches", page: 1, extra: { course: courseId } });
  const students = useListQuery(
    { resource: "students", page: 1, extra: { course: courseId, batch: batchId } },
    { skip: !batchId },
  );
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const monthRows = useListQuery(
    {
      resource: "attendance",
      page: 1,
      extra: { batchId, courseId, month: monthKey },
    },
    { skip: !batchId },
  );
  const dayRows = useListQuery(
    {
      resource: "attendance",
      page: 1,
      extra: { batchId, courseId, date },
    },
    { skip: !batchId || !date },
  );

  const [act, saveState] = useActionMutation();
  const [patch, patchState] = usePatchMutation();

  const batchList = batches.data?.data ?? [];
  const selectedBatch = batchList.find((b) => String(b._id) === batchId);
  const courseIdResolved = courseId || String(selectedBatch?.course ?? "");
  const studentList = students.data?.data ?? [];
  const calendarData = monthRows.data?.data ?? [];
  const dayData = dayRows.data?.data ?? [];

  useEffect(() => {
    const next: Record<string, Mark> = {};
    for (const row of dayData) {
      next[studentRefId(row)] = (row.status as Mark) ?? "present";
    }
    setMarks(next);
    setSelected(new Set());
  }, [dayData, date, batchId]);

  const counts = useMemo(() => {
    const next = { present: 0, absent: 0, late: 0 };
    for (const s of studentList) {
      const v = marks[String(s._id)] ?? "present";
      next[v] += 1;
    }
    return next;
  }, [studentList, marks]);

  function toggleStudent(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === studentList.length) setSelected(new Set());
    else setSelected(new Set(studentList.map((s) => String(s._id))));
  }

  function applyToSelected(status: Mark) {
    if (!selected.size) {
      toast("Select at least one student", "error");
      return;
    }
    setMarks((prev) => {
      const next = { ...prev };
      for (const id of selected) next[id] = status;
      return next;
    });
  }

  async function saveDayAttendance(ids?: string[]) {
    if (!batchId || !courseIdResolved) {
      toast("Select course and batch", "error");
      return;
    }
    const targetIds = ids ?? studentList.map((s) => String(s._id));
    if (!targetIds.length) return;
    try {
      await act({
        path: "attendance/bulk",
        body: {
          batchId,
          courseId: courseIdResolved,
          date,
          session: "default",
          marks: targetIds.map((studentId) => ({
            studentId,
            status: marks[studentId] ?? "present",
          })),
        },
      }).unwrap();
      toast("Attendance saved");
      void monthRows.refetch();
      void dayRows.refetch();
    } catch {
      toast("Save failed", "error");
    }
  }

  const monthStats = useMemo(() => {
    const next = { present: 0, absent: 0, late: 0 };
    for (const row of calendarData) {
      const status = String(row.status);
      if (status === "present") next.present += 1;
      else if (status === "absent") next.absent += 1;
      else if (status === "late") next.late += 1;
    }
    return next;
  }, [calendarData]);

  return (
    <div>
      <PageHeader title="Attendance" description="Filter by course and batch, mark daily attendance, edit any day from the calendar." />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <label className="block">
          <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">Course</span>
          <Select
            value={courseId}
            onChange={(e) => {
              setCourseId(e.target.value);
              setBatchId("");
            }}
          >
            <option value="">All courses</option>
            {(courses.data?.data ?? []).map((c) => (
              <option key={String(c._id)} value={String(c._id)}>
                {loc(c.title)}
              </option>
            ))}
          </Select>
        </label>
        <label className="block">
          <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">Batch</span>
          <Select value={batchId} onChange={(e) => setBatchId(e.target.value)}>
            <option value="">Select batch</option>
            {batchList.map((b) => (
              <option key={String(b._id)} value={String(b._id)}>
                {String(b.label ?? b._id)}
              </option>
            ))}
          </Select>
        </label>
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
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">Date</span>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>

      {!batchId ? (
        <EmptyState title="Select a batch" body="Choose course and batch to view the calendar and mark attendance." />
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            <StatCard label="Month present" value={monthStats.present} />
            <StatCard label="Month late" value={monthStats.late} />
            <StatCard label="Month absent" value={monthStats.absent} />
            <StatCard label="Day selected" value={date} />
          </div>

          <article className="card mb-6 p-5">
            <h2 className="mb-3 font-sans text-lg font-semibold">Calendar</h2>
            <p className="mb-4 text-sm text-zinc-500">Click a day to mark or edit attendance for that date.</p>
            {monthRows.isLoading ? (
              <Skeleton className="h-72" />
            ) : (
              <AttendanceCalendar
                year={year}
                month={month}
                rows={calendarData}
                selectedDate={date}
                onDayClick={(day) => setDate(day)}
              />
            )}
          </article>

          <article className="card p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-sans text-lg font-semibold">Mark attendance — {date}</h2>
                <p className="text-sm text-zinc-500">Select multiple students and apply status in one action.</p>
              </div>
              {canWrite ? (
                <div className="flex flex-wrap gap-2">
                  <Button variant="ghost" onClick={() => applyToSelected("present")}>
                    Selected → Present
                  </Button>
                  <Button variant="ghost" onClick={() => applyToSelected("late")}>
                    Selected → Late
                  </Button>
                  <Button variant="ghost" onClick={() => applyToSelected("absent")}>
                    Selected → Absent
                  </Button>
                  <Button
                    disabled={saveState.isLoading}
                    onClick={() => saveDayAttendance(selected.size ? [...selected] : undefined)}
                  >
                    {saveState.isLoading ? "Saving…" : selected.size ? `Save ${selected.size} selected` : "Save all"}
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="mb-3 grid gap-3 sm:grid-cols-3">
              <StatCard label="Present" value={counts.present} />
              <StatCard label="Late" value={counts.late} />
              <StatCard label="Absent" value={counts.absent} />
            </div>

            {students.isLoading ? (
              <Skeleton className="h-48" />
            ) : studentList.length === 0 ? (
              <EmptyState title="No students" body="No students found for this course/batch filter." />
            ) : (
              <div className="card divide-y divide-white/5 border border-white/8">
                {canWrite ? (
                  <label className="flex items-center gap-3 px-4 py-3 text-sm text-zinc-400">
                    <input
                      type="checkbox"
                      checked={selected.size === studentList.length && studentList.length > 0}
                      onChange={toggleAll}
                      className="rounded border-white/20"
                    />
                    Select all ({studentList.length})
                  </label>
                ) : null}
                {studentList.map((s) => {
                  const id = String(s._id);
                  const existing = dayData.find((row) => studentRefId(row) === id);
                  return (
                    <div key={id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        {canWrite ? (
                          <input
                            type="checkbox"
                            checked={selected.has(id)}
                            onChange={() => toggleStudent(id)}
                            className="rounded border-white/20"
                          />
                        ) : null}
                        <StudentAvatar photo={s.photo} name={nameFromStudentRow(s)} size="sm" />
                        <div>
                          <p className="font-medium">{nameFromStudentRow(s)}</p>
                          <p className="font-mono text-xs text-accent">{String(s.studentCode)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {existing ? (
                          <button
                            type="button"
                            className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500"
                            onClick={() => setEditRecord(existing)}
                          >
                            Edit record
                          </button>
                        ) : null}
                        <Select
                          className="max-w-40"
                          value={marks[id] ?? "present"}
                          disabled={!canWrite}
                          onChange={(e) => setMarks((m) => ({ ...m, [id]: e.target.value as Mark }))}
                        >
                          <option value="present">Present</option>
                          <option value="late">Late</option>
                          <option value="absent">Absent</option>
                        </Select>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </article>
        </>
      )}

      <Modal open={Boolean(editRecord)} title="Edit attendance" onClose={() => setEditRecord(null)}>
        {editRecord ? (
          <div className="grid gap-3">
            <p className="text-sm text-zinc-400">
              {new Date(String(editRecord.date ?? date)).toISOString().slice(0, 10)} ·{" "}
              {nameFromStudentRow((editRecord.student as Record<string, unknown>) ?? {})}
            </p>
            <Select
              defaultValue={String(editRecord.status ?? "present")}
              onChange={async (e) => {
                try {
                  await patch({
                    resource: "attendance",
                    id: String(editRecord._id),
                    body: { status: e.target.value },
                  }).unwrap();
                  toast("Attendance updated");
                  setEditRecord(null);
                  void monthRows.refetch();
                  void dayRows.refetch();
                } catch {
                  toast("Update failed", "error");
                }
              }}
            >
              <option value="present">Present</option>
              <option value="late">Late</option>
              <option value="absent">Absent</option>
            </Select>
            {patchState.isLoading ? <p className="text-xs text-zinc-500">Saving…</p> : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
