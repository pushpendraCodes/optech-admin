import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader, EmptyState, Skeleton, StatusBadge } from "@/components/Chrome";
import { Button } from "@/components/Button";
import { Field, Input, Select, Textarea } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { useActionMutation, useCreateMutation, useListQuery } from "@/app/api";
import { toast } from "@/components/Toast";
import { useCan } from "@/hooks/useAuth";

const schema = z.object({
  title: z.string().min(2),
  body: z.string().min(4),
  type: z.enum(["general", "fee_due", "notice", "exam", "live_class", "admission"]),
  audience: z.enum(["ALL", "COURSE", "BATCH", "STUDENT"]),
  scheduledAt: z.string().optional(),
  broadcast: z.boolean(),
});

type Form = z.infer<typeof schema>;

export function NotificationsPage({ reminder = false }: { reminder?: boolean }) {
  const canWrite = useCan("notification:create");
  const canBroadcast = useCan("notification:broadcast");
  const [open, setOpen] = useState(false);
  const { data, isLoading, isError, refetch } = useListQuery({ resource: "notifications", page: 1 });
  const [create, createState] = useCreateMutation();
  const [act] = useActionMutation();
  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: reminder ? "fee_due" : "general",
      audience: "ALL",
      broadcast: true,
    },
  });
  const rows = data?.data ?? [];

  return (
    <div>
      <PageHeader
        title={reminder ? "WhatsApp reminders" : "Notifications"}
        description={
          reminder
            ? "Compose fee-due reminders here. Staff send WhatsApp messages manually — the API does not send them."
            : "Compose to everyone, a course, a batch, or one student. Delivery analytics stay on the server."
        }
        actions={
          canWrite ? (
            <Button type="button" onClick={() => setOpen(true)}>
              Compose
            </Button>
          ) : null
        }
      />
      {isLoading ? (
        <Skeleton className="h-40" />
      ) : isError ? (
        <EmptyState title="Could not load notifications" body="Retry after the API is up." action={<Button onClick={() => refetch()}>Retry</Button>} />
      ) : rows.length === 0 ? (
        <EmptyState title="Nothing queued" body="Compose the first broadcast." />
      ) : (
        <div className="grid gap-3">
          {rows.map((row) => (
            <article key={String(row._id)} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold">{String(row.title)}</p>
                <p className="text-sm text-zinc-400">{String(row.body)}</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge value={row.sentAt ? "sent" : "scheduled"} />
                {canBroadcast && !row.sentAt ? (
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      try {
                        await act({ path: `notifications/${String(row._id)}/broadcast` }).unwrap();
                        toast("Queued for delivery");
                      } catch {
                        toast("Broadcast failed", "error");
                      }
                    }}
                  >
                    Broadcast
                  </Button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
      <Modal open={open} title="Compose notification" onClose={() => setOpen(false)}>
        <form
          className="grid gap-3"
          onSubmit={form.handleSubmit(async (values) => {
            try {
              await create({
                resource: "notifications",
                body: {
                  ...values,
                  scheduledAt: values.scheduledAt || undefined,
                },
              }).unwrap();
              toast("Notification saved");
              setOpen(false);
              form.reset({ type: reminder ? "fee_due" : "general", audience: "ALL", broadcast: true, title: "", body: "" });
            } catch {
              toast("Save failed", "error");
            }
          })}
        >
          <Field label="Title" error={form.formState.errors.title?.message}>
            <Input {...form.register("title")} />
          </Field>
          <Field label="Message" error={form.formState.errors.body?.message}>
            <Textarea {...form.register("body")} />
          </Field>
          <Field label="Category">
            <Select {...form.register("type")}>
              <option value="general">General</option>
              <option value="fee_due">Fee due</option>
              <option value="notice">Notice</option>
              <option value="exam">Exam</option>
              <option value="live_class">Live class</option>
              <option value="admission">Admission</option>
            </Select>
          </Field>
          <Field label="Audience">
            <Select {...form.register("audience")}>
              <option value="ALL">Everyone</option>
              <option value="COURSE">Course</option>
              <option value="BATCH">Batch</option>
              <option value="STUDENT">Student</option>
            </Select>
          </Field>
          <Field label="Schedule">
            <Input type="datetime-local" {...form.register("scheduledAt")} />
          </Field>
          <label className="flex items-center gap-2 text-sm text-zinc-400">
            <input type="checkbox" {...form.register("broadcast")} />
            Broadcast immediately
          </label>
          <Button type="submit" disabled={createState.isLoading}>
            {createState.isLoading ? "Saving…" : "Save"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
