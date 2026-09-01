import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader, EmptyState, Skeleton, StatusBadge } from "@/components/Chrome";
import { Button } from "@/components/Button";
import { Field, Input, Select } from "@/components/Field";
import { ConfirmDialog, Modal } from "@/components/Modal";
import { useActionMutation, useListQuery, usePatchMutation, useRemoveMutation } from "@/app/api";
import { toast } from "@/components/Toast";
import { useCan } from "@/hooks/useAuth";
import { isoDate, loc } from "@/utils/format";

const schema = z.object({
  course: z.string().min(1),
  label: z.string().min(1),
  timing: z.string().min(1),
  seats: z.coerce.number().min(1),
  start: z.string().optional(),
  active: z.boolean().optional(),
});

type Form = z.infer<typeof schema>;

function courseId(row: Record<string, unknown>) {
  const course = row.course;
  if (course && typeof course === "object" && "_id" in (course as object)) return String((course as { _id: unknown })._id);
  return course ? String(course) : "";
}

function courseLabel(row: Record<string, unknown>) {
  const course = row.course;
  if (course && typeof course === "object" && "title" in (course as object)) return loc((course as { title: unknown }).title);
  return "—";
}

function rowToForm(row: Record<string, unknown>): Form {
  return {
    course: courseId(row),
    label: String(row.label ?? ""),
    timing: String(row.timing ?? ""),
    seats: Number(row.seats ?? 1),
    start: isoDate(String(row.start ?? "")),
    active: row.active !== false,
  };
}

export function BatchesPage() {
  const canWrite = useCan("course:update");
  const [courseFilter, setCourseFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState<Record<string, unknown> | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const { data, isLoading, isError, refetch } = useListQuery({ resource: "batches", page: 1, extra: { course: courseFilter } });
  const courses = useListQuery({ resource: "courses", page: 1 });
  const [act, createState] = useActionMutation();
  const [patch, patchState] = usePatchMutation();
  const [remove, removeState] = useRemoveMutation();
  const createForm = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { active: true } });
  const editForm = useForm<Form>({ resolver: zodResolver(schema) });
  const rows = data?.data ?? [];
  const courseRows = courses.data?.data ?? [];

  function BatchForm({
    form,
    editing,
    onSubmit,
    busy,
    submitLabel,
  }: {
    form: ReturnType<typeof useForm<Form>>;
    editing: boolean;
    onSubmit: (values: Form) => Promise<void>;
    busy: boolean;
    submitLabel: string;
  }) {
    return (
      <form
        className="grid gap-3"
        onSubmit={form.handleSubmit(async (values) => {
          try {
            await onSubmit(values);
            toast(editing ? "Batch updated" : "Batch saved");
          } catch (err) {
            toast((err as { data?: { message?: string } })?.data?.message ?? "Save failed", "error");
          }
        })}
      >
        <Field label="Course" error={form.formState.errors.course?.message}>
          <Select {...form.register("course")} disabled={editing}>
            <option value="">Select</option>
            {courseRows.map((c) => (
              <option key={String(c._id)} value={String(c._id)}>
                {loc(c.title)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Label" error={form.formState.errors.label?.message}>
          <Input {...form.register("label")} />
        </Field>
        <Field label="Timing" error={form.formState.errors.timing?.message}>
          <Input placeholder="Mon–Sat 8:00–10:00" {...form.register("timing")} />
        </Field>
        <Field label="Seats">
          <Input type="number" {...form.register("seats")} />
        </Field>
        <Field label="Start date">
          <Input type="date" {...form.register("start")} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input type="checkbox" {...form.register("active")} className="rounded border-white/20" />
          Active batch
        </label>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : submitLabel}
        </Button>
      </form>
    );
  }

  return (
    <div>
      <PageHeader
        title="Batches"
        description="Timing, seats, and course assignment."
        actions={
          canWrite ? (
            <Button
              type="button"
              onClick={() => {
                createForm.reset({ active: true });
                setCreateOpen(true);
              }}
            >
              New batch
            </Button>
          ) : null
        }
      />
      <div className="mb-4 max-w-md">
        <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">Filter by course</label>
        <Select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
          <option value="">All courses</option>
          {courseRows.map((c) => (
            <option key={String(c._id)} value={String(c._id)}>
              {loc(c.title)}
            </option>
          ))}
        </Select>
      </div>
      {isLoading ? (
        <Skeleton className="h-40" />
      ) : isError ? (
        <EmptyState title="Could not load batches" body="Retry once the API is available." action={<Button onClick={() => refetch()}>Retry</Button>} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No batches"
          body={courseFilter ? "No batches found for this course. Try another filter or create one." : "Attach the first batch to a course."}
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-white/8 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              <tr>
                <th className="px-4 py-3 text-left">Label</th>
                <th className="px-4 py-3 text-left">Course</th>
                <th className="px-4 py-3 text-left">Timing</th>
                <th className="px-4 py-3 text-left">Seats</th>
                <th className="px-4 py-3 text-left">Start</th>
                <th className="px-4 py-3 text-left">Active</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={String(row._id)} className="border-b border-white/5">
                  <td className="px-4 py-3">{String(row.label)}</td>
                  <td className="px-4 py-3">{courseLabel(row)}</td>
                  <td className="px-4 py-3">{String(row.timing)}</td>
                  <td className="px-4 py-3">{String(row.seats ?? "—")}</td>
                  <td className="px-4 py-3 font-mono text-xs">{isoDate(String(row.start ?? "")) || "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge value={row.active ? "active" : "inactive"} />
                  </td>
                  <td className="px-4 py-3">
                    {canWrite ? (
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          onClick={() => {
                            editForm.reset(rowToForm(row));
                            setEditRow(row);
                          }}
                        >
                          Edit
                        </Button>
                        <button
                          type="button"
                          className="font-mono text-[10px] uppercase tracking-[0.16em] text-danger"
                          onClick={() => setRemoveId(String(row._id))}
                        >
                          Delete
                        </button>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={createOpen} title="New batch" onClose={() => setCreateOpen(false)}>
        <BatchForm
          form={createForm}
          editing={false}
          busy={createState.isLoading}
          submitLabel="Save"
          onSubmit={async (values) => {
            await act({
              path: `courses/${values.course}/batches`,
              body: {
                label: values.label,
                timing: values.timing,
                seats: values.seats,
                start: values.start || undefined,
                active: values.active ?? true,
              },
            }).unwrap();
            setCreateOpen(false);
            createForm.reset();
          }}
        />
      </Modal>

      <Modal open={Boolean(editRow)} title="Edit batch" onClose={() => setEditRow(null)}>
        <BatchForm
          form={editForm}
          editing
          busy={patchState.isLoading}
          submitLabel="Update"
          onSubmit={async (values) => {
            if (!editRow) return;
            await patch({
              resource: "batches",
              id: String(editRow._id),
              body: {
                label: values.label,
                timing: values.timing,
                seats: values.seats,
                start: values.start || undefined,
                active: values.active ?? true,
              },
            }).unwrap();
            setEditRow(null);
          }}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(removeId)}
        title="Delete batch?"
        body="Students assigned to this batch may lose their schedule link. Delete only if unused."
        busy={removeState.isLoading}
        onClose={() => setRemoveId(null)}
        onConfirm={async () => {
          if (!removeId) return;
          try {
            await remove({ resource: "batches", id: removeId }).unwrap();
            toast("Deleted");
            setRemoveId(null);
          } catch {
            toast("Delete failed — batch may still be in use", "error");
          }
        }}
      />
    </div>
  );
}
