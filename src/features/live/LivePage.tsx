import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader, EmptyState, Skeleton, StatusBadge } from "@/components/Chrome";
import { Button } from "@/components/Button";
import { Field, Input, Select } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { useCreateMutation, useListQuery, usePatchMutation } from "@/app/api";
import { toast } from "@/components/Toast";
import { useCan } from "@/hooks/useAuth";
import { loc } from "@/utils/format";

const schema = z.object({
  title: z.string().min(2),
  course: z.string().min(1),
  batch: z.string().optional(),
  youtubeUrl: z.string().url(),
  startsAt: z.string().min(1),
});

type Form = z.infer<typeof schema>;

function sessionStatus(row: Record<string, unknown>): string {
  if (row.endsAt) return "closed";
  if (row.isLive) return "live";
  return String(row.status ?? "scheduled");
}

export function LivePage() {
  const canWrite = useCan("live:write");
  const [open, setOpen] = useState(false);
  const { data, isLoading, isError, refetch } = useListQuery({ resource: "live", page: 1 });
  const courses = useListQuery({ resource: "courses", page: 1 });
  const [create, createState] = useCreateMutation();
  const [patch, patchState] = usePatchMutation();
  const form = useForm<Form>({ resolver: zodResolver(schema) });
  const selectedCourse = form.watch("course");
  const batches = useListQuery(
    { resource: "batches", page: 1, extra: { course: selectedCourse } },
    { skip: !selectedCourse },
  );
  const courseBatches = batches.data?.data ?? [];
  const rows = data?.data ?? [];

  async function updateSession(id: string, action: "go_live" | "end", label: string) {
    try {
      await patch({ resource: "live", id, body: { action } }).unwrap();
      toast(label);
      refetch();
    } catch (err) {
      const msg = (err as { data?: { message?: string } })?.data?.message;
      toast(msg ?? "Update failed", "error");
    }
  }

  return (
    <div>
      <PageHeader
        title="Live classes"
        description="YouTube sessions for enrolled students. Students are notified when a class is scheduled."
        actions={
          canWrite ? (
            <Button type="button" onClick={() => setOpen(true)}>
              Schedule
            </Button>
          ) : null
        }
      />
      {isLoading ? (
        <Skeleton className="h-40" />
      ) : isError ? (
        <EmptyState title="Could not load live classes" body="Retry after the API is up." action={<Button onClick={() => refetch()}>Retry</Button>} />
      ) : rows.length === 0 ? (
        <EmptyState title="No sessions" body="Schedule the first YouTube class." />
      ) : (
        <div className="grid gap-3">
          {rows.map((row) => {
            const status = sessionStatus(row);
            const closed = status === "closed";
            return (
              <article key={String(row._id)} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-semibold">{String(row.title)}</p>
                  <p className="text-sm text-zinc-400">{String(row.youtubeUrl ?? "")}</p>
                  <p className="text-xs text-zinc-500">
                    Starts {String(row.startsAt ?? "").slice(0, 16)}
                    {row.endsAt ? ` · Ended ${String(row.endsAt).slice(0, 16)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge value={status} />
                  {canWrite && !closed ? (
                    status === "live" ? (
                      <Button
                        variant="ghost"
                        disabled={patchState.isLoading}
                        onClick={() => void updateSession(String(row._id), "end", "Session closed")}
                      >
                        End class
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        disabled={patchState.isLoading}
                        onClick={() => void updateSession(String(row._id), "go_live", "Marked live")}
                      >
                        Go live
                      </Button>
                    )
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
      <Modal open={open} title="Schedule live class" onClose={() => setOpen(false)}>
        <form
          className="grid gap-3"
          onSubmit={form.handleSubmit(async (values) => {
            try {
              await create({
                resource: "live",
                body: {
                  ...values,
                  batch: values.batch || undefined,
                  startsAt: new Date(values.startsAt).toISOString(),
                },
              }).unwrap();
              toast("Scheduled — students will be notified");
              setOpen(false);
              form.reset();
              refetch();
            } catch (err) {
              const msg = (err as { data?: { message?: string } })?.data?.message;
              toast(msg ?? "Save failed", "error");
            }
          })}
        >
          <Field label="Title" error={form.formState.errors.title?.message}>
            <Input {...form.register("title")} />
          </Field>
          <Field label="Course">
            <Select
              {...form.register("course")}
              onChange={(e) => {
                form.setValue("course", e.target.value, { shouldValidate: true });
                form.setValue("batch", "");
              }}
            >
              <option value="">Select</option>
              {(courses.data?.data ?? []).map((c) => (
                <option key={String(c._id)} value={String(c._id)}>
                  {loc(c.title)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Batch">
            <Select {...form.register("batch")} disabled={!selectedCourse || batches.isLoading}>
              <option value="">
                {!selectedCourse
                  ? "Select a course first"
                  : batches.isLoading
                    ? "Loading batches…"
                    : courseBatches.length
                      ? "All course students (optional batch)"
                      : "No batches for this course"}
              </option>
              {courseBatches.map((b) => (
                <option key={String(b._id)} value={String(b._id)}>
                  {String(b.label ?? b._id)}
                  {b.timing ? ` · ${String(b.timing)}` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="YouTube URL" error={form.formState.errors.youtubeUrl?.message}>
            <Input {...form.register("youtubeUrl")} />
          </Field>
          <Field label="Starts">
            <Input type="datetime-local" {...form.register("startsAt")} />
          </Field>
          <Button type="submit" disabled={createState.isLoading}>
            {createState.isLoading ? "Saving…" : "Save & notify students"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
