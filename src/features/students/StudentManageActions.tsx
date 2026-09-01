import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/Button";
import { Field, Input, Select, Textarea } from "@/components/Field";
import { ConfirmDialog, Modal } from "@/components/Modal";
import { useActionMutation, useListQuery, usePatchMutation } from "@/app/api";
import { toast } from "@/components/Toast";
import { useCan } from "@/hooks/useAuth";
import { PhotoUploadField, type PhotoAsset } from "@/components/StudentPhoto";
import { isoDate } from "@/utils/format";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().min(8),
  parentPhone: z.string().optional(),
  address: z.string().optional(),
  dob: z.string().optional(),
  rollNumber: z.string().optional(),
  validTill: z.string().optional(),
  batch: z.string().optional(),
});

type Form = z.infer<typeof schema>;

function batchId(batch: unknown) {
  if (batch && typeof batch === "object" && "_id" in (batch as object)) return String((batch as { _id: unknown })._id);
  return batch ? String(batch) : "";
}

function courseId(course: unknown) {
  if (course && typeof course === "object" && "_id" in (course as object)) return String((course as { _id: unknown })._id);
  return course ? String(course) : "";
}

function enrolledCourseIds(enrollments: Record<string, unknown>[]) {
  const rows = enrollments.filter((row) => !row.status || row.status === "active");
  return [...new Set(rows.map((row) => courseId(row.course)).filter(Boolean))];
}

export function StudentManageActions({
  studentId,
  student,
  user,
  enrollments = [],
  onUpdated,
}: {
  studentId: string;
  student: Record<string, unknown>;
  user: { name?: string; email?: string; phone?: string } | undefined;
  enrollments?: Record<string, unknown>[];
  onUpdated: () => void;
}) {
  const canUpdate = useCan("student:update");
  const [editOpen, setEditOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [photo, setPhoto] = useState<PhotoAsset | null>(null);
  const [issued, setIssued] = useState<{ studentCode: string; password: string } | null>(null);
  const courseIds = useMemo(() => enrolledCourseIds(enrollments), [enrollments]);
  const batches = useListQuery({ resource: "batches", page: 1, limit: 100 }, { skip: courseIds.length === 0 });
  const courseBatches = useMemo(() => {
    const allowed = new Set(courseIds);
    return (batches.data?.data ?? []).filter((row) => allowed.has(courseId(row.course)));
  }, [batches.data?.data, courseIds]);
  const [patch, patchState] = usePatchMutation();
  const [act, resetState] = useActionMutation();
  const form = useForm<Form>({ resolver: zodResolver(schema) });

  if (!canUpdate) return null;

  function openEdit() {
    form.reset({
      name: user?.name ?? "",
      email: user?.email ?? "",
      phone: user?.phone ?? "",
      parentPhone: String(student.parentPhone ?? ""),
      address: String(student.address ?? ""),
      dob: student.dob ? isoDate(String(student.dob)) : "",
      rollNumber: String(student.rollNumber ?? ""),
      validTill: student.validTill ? isoDate(String(student.validTill)) : "",
      batch: batchId(student.batch),
    });
    setPhoto((student.photo as PhotoAsset | undefined) ?? null);
    setEditOpen(true);
  }

  return (
    <>
      <Button variant="ghost" onClick={openEdit}>
        Edit
      </Button>
      <Button variant="ghost" onClick={() => setResetOpen(true)}>
        New password
      </Button>

      <Modal open={editOpen} title="Edit student" onClose={() => setEditOpen(false)}>
        <form
          className="grid gap-3"
          onSubmit={form.handleSubmit(async (values) => {
            try {
              await patch({
                resource: "students",
                id: studentId,
                body: {
                  name: values.name,
                  email: values.email || undefined,
                  phone: values.phone,
                  parentPhone: values.parentPhone || undefined,
                  address: values.address || undefined,
                  dob: values.dob || undefined,
                  rollNumber: values.rollNumber || undefined,
                  validTill: values.validTill || undefined,
                  batch: values.batch || undefined,
                  photo: photo ?? undefined,
                },
              }).unwrap();
              toast("Student updated");
              setEditOpen(false);
              onUpdated();
            } catch (err) {
              toast((err as { data?: { message?: string } })?.data?.message ?? "Update failed", "error");
            }
          })}
        >
          <PhotoUploadField value={photo} onChange={setPhoto} />
          <Field label="Name" error={form.formState.errors.name?.message}>
            <Input {...form.register("name")} />
          </Field>
          <Field label="Email" error={form.formState.errors.email?.message}>
            <Input type="email" {...form.register("email")} />
          </Field>
          <Field label="Phone" error={form.formState.errors.phone?.message}>
            <Input {...form.register("phone")} />
          </Field>
          <Field label="Parent phone">
            <Input {...form.register("parentPhone")} />
          </Field>
          <Field label="Address">
            <Textarea {...form.register("address")} />
          </Field>
          <Field label="Date of birth">
            <Input type="date" {...form.register("dob")} />
          </Field>
          <Field label="Roll number">
            <Input {...form.register("rollNumber")} />
          </Field>
          <Field label="Valid till">
            <Input type="date" {...form.register("validTill")} />
          </Field>
          <Field label="Assigned batch">
            <Select {...form.register("batch")} disabled={courseIds.length === 0 || batches.isLoading}>
              <option value="">
                {courseIds.length === 0
                  ? "No enrolled course"
                  : batches.isLoading
                    ? "Loading batches…"
                    : courseBatches.length
                      ? "None"
                      : "No batches for enrolled course"}
              </option>
              {courseBatches.map((b) => (
                <option key={String(b._id)} value={String(b._id)}>
                  {String(b.label ?? b._id)}
                  {b.timing ? ` · ${String(b.timing)}` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <p className="text-xs text-zinc-500">Student ID {String(student.studentCode)} and referral code cannot be changed here.</p>
          <Button type="submit" disabled={patchState.isLoading}>
            {patchState.isLoading ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </Modal>

      <ConfirmDialog
        open={resetOpen}
        title="Generate new password?"
        body={`Issue a new portal password for ${String(student.studentCode)}. The old password stops working immediately.`}
        busy={resetState.isLoading}
        onClose={() => setResetOpen(false)}
        onConfirm={async () => {
          try {
            const res = await act({ path: `students/${studentId}/reset-password` }).unwrap();
            const payload = res.data as { studentCode?: string; password?: string };
            setIssued({
              studentCode: payload.studentCode ?? String(student.studentCode),
              password: payload.password ?? "",
            });
            setResetOpen(false);
            toast("New password generated");
          } catch {
            toast("Password reset failed", "error");
          }
        }}
      />

      <Modal open={Boolean(issued)} title="New credentials" onClose={() => setIssued(null)}>
        <p className="text-sm text-zinc-400">Share these once. The password is not stored in plain text after this response.</p>
        <p className="mt-4 font-mono text-accent">{issued?.studentCode}</p>
        <p className="mt-1 font-mono">{issued?.password}</p>
        <Button className="mt-4" onClick={() => setIssued(null)}>
          Done
        </Button>
      </Modal>
    </>
  );
}
