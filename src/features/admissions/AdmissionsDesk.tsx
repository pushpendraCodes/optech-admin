import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader, EmptyState, Skeleton, StatusBadge } from "@/components/Chrome";
import { Button } from "@/components/Button";
import { Field, Input, Select, Textarea } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { PhotoUploadField, StudentAvatar, type PhotoAsset } from "@/components/StudentPhoto";
import { useActionMutation, useCreateMutation, useListQuery, usePatchMutation } from "@/app/api";
import { toast } from "@/components/Toast";
import { useCan } from "@/hooks/useAuth";
import { isoDate, loc, rupees } from "@/utils/format";
import { buildInstallmentPreview, courseFee } from "@/utils/installments";

const schema = z.object({
  name: z.string().min(2),
  phone: z.string().min(8),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().min(5, "Enter full address"),
  dob: z.string().min(1, "Date of birth is required"),
  parentPhone: z.string().min(8, "Enter parent/guardian number"),
  course: z.string().min(1, "Select a course"),
  batch: z.string().optional(),
  feePlan: z.enum(["full", "installment"]),
  paymentMode: z.enum(["cash", "online"]),
  referrerCode: z.string().optional().or(z.literal("")),
});

type Form = z.infer<typeof schema>;

type IssuedCredentials = {
  studentCode: string;
  password: string;
  name?: string;
  phone?: string;
  parentPhone?: string;
};

function whatsappDigits(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

function credentialsText(c: IssuedCredentials) {
  const lines = [
    `Optech admission confirmed${c.name ? ` for ${c.name}` : ""}.`,
    "",
    `Student ID: ${c.studentCode}`,
    `Password: ${c.password}`,
    "",
    "Login at the student portal and change your password after first sign-in.",
  ];
  return lines.join("\n");
}

function whatsappLink(phone: string, text: string) {
  return `https://wa.me/${whatsappDigits(phone)}?text=${encodeURIComponent(text)}`;
}

function admissionBody(values: Form, photo: PhotoAsset | null) {
  const referrerCode = values.referrerCode?.trim().toUpperCase();
  return {
    ...values,
    email: values.email || undefined,
    batch: values.batch || undefined,
    dob: values.dob || undefined,
    referrerCode: referrerCode || undefined,
    photo: photo ?? undefined,
  };
}

export function AdmissionsDesk() {
  const canWrite = useCan("admission:write");
  const [status, setStatus] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState<Record<string, unknown> | null>(null);
  const [photo, setPhoto] = useState<PhotoAsset | null>(null);
  const [issued, setIssued] = useState<IssuedCredentials | null>(null);
  const { data, isLoading, isError, refetch } = useListQuery({
    resource: "admissions",
    page: 1,
    extra: { status },
  });
  const courses = useListQuery({ resource: "courses", page: 1 });
  const [act, confirmState] = useActionMutation();
  const [create, createState] = useCreateMutation();
  const [patch, patchState] = usePatchMutation();
  const form = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { feePlan: "full", paymentMode: "cash" } });
  const selectedCourse = form.watch("course");
  const feePlan = form.watch("feePlan");
  const courseRows = courses.data?.data ?? [];
  const selectedCourseRow = courseRows.find((c) => String(c._id) === selectedCourse);
  const installmentPreview = useMemo(() => {
    if (feePlan !== "installment" || !selectedCourseRow) return null;
    return buildInstallmentPreview(courseFee(selectedCourseRow));
  }, [feePlan, selectedCourseRow]);
  const batches = useListQuery(
    { resource: "batches", page: 1, extra: { course: selectedCourse } },
    { skip: !selectedCourse },
  );
  const rows = data?.data ?? [];
  const courseBatches = batches.data?.data ?? [];
  const editing = Boolean(editRow);
  const modalOpen = createOpen || editing;

  useEffect(() => {
    if (!selectedCourse || batches.isLoading || courseBatches.length === 0) return;
    const current = form.getValues("batch");
    if (current && courseBatches.some((b) => String(b._id) === current)) return;
    form.setValue("batch", String(courseBatches[0]._id));
  }, [selectedCourse, courseBatches, batches.isLoading, form]);

  function openCreate() {
    setEditRow(null);
    setPhoto(null);
    form.reset({ feePlan: "full", paymentMode: "cash" });
    setCreateOpen(true);
  }

  function openEdit(row: Record<string, unknown>) {
    setCreateOpen(false);
    setEditRow(row);
    setPhoto((row.photo as PhotoAsset | undefined) ?? null);
    form.reset({
      name: String(row.name ?? ""),
      phone: String(row.phone ?? ""),
      email: String(row.email ?? ""),
      address: String(row.address ?? ""),
      dob: row.dob ? isoDate(String(row.dob)) : "",
      parentPhone: String(row.parentPhone ?? ""),
      course: String(row.course ?? ""),
      batch: row.batch ? String(row.batch) : "",
      feePlan: (row.feePlan as "full" | "installment") ?? "full",
      paymentMode: (row.paymentMode as "cash" | "online") ?? "cash",
      referrerCode: String(row.referrerCode ?? ""),
    });
  }

  function closeModal() {
    setCreateOpen(false);
    setEditRow(null);
    setPhoto(null);
  }

  function AdmissionFields() {
    return (
      <>
        <PhotoUploadField value={photo} onChange={setPhoto} />
        <Field label="Name" error={form.formState.errors.name?.message}>
          <Input {...form.register("name")} />
        </Field>
        <Field label="Phone" error={form.formState.errors.phone?.message}>
          <Input {...form.register("phone")} />
          <p className="mt-1 text-xs text-zinc-500">Prefer WhatsApp number</p>
        </Field>
        <Field label="Email" error={form.formState.errors.email?.message}>
          <Input type="email" {...form.register("email")} />
        </Field>
        <Field label="Address" error={form.formState.errors.address?.message}>
          <Textarea placeholder="House no., street, village/town, district, PIN" {...form.register("address")} />
        </Field>
        <Field label="Date of birth" error={form.formState.errors.dob?.message}>
          <Input type="date" {...form.register("dob")} />
        </Field>
        <Field label="Parent / guardian number" error={form.formState.errors.parentPhone?.message}>
          <Input placeholder="10-digit mobile" {...form.register("parentPhone")} />
          <p className="mt-1 text-xs text-zinc-500">Prefer WhatsApp number</p>
        </Field>
        <Field label="Course" error={form.formState.errors.course?.message}>
          <Select
            {...form.register("course")}
            onChange={(e) => {
              form.setValue("course", e.target.value, { shouldValidate: true });
              form.setValue("batch", "");
            }}
          >
            <option value="">Select course</option>
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
              {!selectedCourse ? "Select a course first" : batches.isLoading ? "Loading batches…" : courseBatches.length ? "Select batch" : "No batches for this course"}
            </option>
            {courseBatches.map((b) => (
              <option key={String(b._id)} value={String(b._id)}>
                {String(b.label ?? b._id)}
                {b.timing ? ` · ${String(b.timing)}` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Fee plan">
          <Select {...form.register("feePlan")}>
            <option value="full">Full</option>
            <option value="installment">Installment</option>
          </Select>
        </Field>
        {feePlan === "full" && selectedCourse ? (
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Full fee</p>
            <p className="mt-2 flex items-center justify-between text-sm">
              <span>{loc(selectedCourseRow?.title) || "Selected course"}</span>
              <span className="font-mono text-lg text-accent">{rupees(courseFee(selectedCourseRow))}</span>
            </p>
            <p className="mt-1 text-xs text-zinc-500">One-time payment for the full course fee.</p>
          </div>
        ) : null}
        {feePlan === "installment" && selectedCourse ? (
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Installment schedule</p>
            {!installmentPreview?.allowed ? (
              <p className="mt-2 text-xs text-amber-300">
                Course fee {rupees(courseFee(selectedCourseRow))} is below the EMI minimum (₹8,000). Use full payment instead.
              </p>
            ) : (
              <>
                <p className="mt-1 text-xs text-zinc-400">
                  Total {rupees(courseFee(selectedCourseRow))} split into {installmentPreview.parts} parts from today.
                </p>
                <ul className="mt-3 space-y-2 text-sm">
                  {installmentPreview.schedule.map((row) => (
                    <li key={row.sequence} className="flex items-center justify-between border-t border-white/8 pt-2">
                      <span>
                        Part {row.sequence} · due {isoDate(row.dueDate)}
                      </span>
                      <span className="font-mono text-accent">{rupees(row.amount)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        ) : null}
        <Field label="Payment mode">
          <Select {...form.register("paymentMode")}>
            <option value="cash">Cash</option>
            <option value="online">Online</option>
          </Select>
        </Field>
        <Field label="Referral code" error={form.formState.errors.referrerCode?.message}>
          <Input placeholder="Existing student's referral code (optional)" {...form.register("referrerCode")} />
          <p className="mt-1 text-xs text-zinc-500">
            If a current student referred this applicant, enter their referral code. It is recorded when you confirm admission.
          </p>
        </Field>
      </>
    );
  }

  return (
    <div>
      <PageHeader
        title="Admissions"
        description="Confirm to issue student ID + temporary password."
        actions={
          canWrite ? (
            <Button type="button" onClick={openCreate}>
              New admission
            </Button>
          ) : null
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {["", "draft", "hold", "confirmed", "cancelled"].map((s) => (
          <Button key={s || "all"} variant={status === s ? "primary" : "ghost"} onClick={() => setStatus(s)}>
            {s || "all"}
          </Button>
        ))}
      </div>
      {isLoading ? (
        <Skeleton className="h-40" />
      ) : isError ? (
        <EmptyState title="Could not load admissions" body="Retry after the API is up." action={<Button onClick={() => refetch()}>Retry</Button>} />
      ) : rows.length === 0 ? (
        <EmptyState title="No admissions" body="Create a draft to start the campus intake flow." />
      ) : (
        <div className="grid gap-3">
          {rows.map((row) => (
            <article key={String(row._id)} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <StudentAvatar photo={row.photo} name={String(row.name)} size="md" />
                <div>
                  <p className="font-semibold">{String(row.name)}</p>
                  <p className="text-sm text-zinc-400">
                    {String(row.phone)} · {String(row.email ?? "no email")}
                  </p>
                  {row.parentPhone || row.address || row.dob ? (
                    <p className="mt-1 text-xs text-zinc-500">
                      {row.parentPhone ? `Parent: ${String(row.parentPhone)}` : null}
                      {row.dob ? `${row.parentPhone ? " · " : ""}DOB: ${isoDate(String(row.dob))}` : null}
                      {row.address ? `${row.parentPhone || row.dob ? " · " : ""}${String(row.address)}` : null}
                    </p>
                  ) : null}
                  {row.referrerCode ? (
                    <p className="mt-1 text-xs text-accent">Referral code: {String(row.referrerCode)}</p>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge value={String(row.status)} />
                {row.status !== "confirmed" && canWrite ? (
                  <>
                    <Button variant="ghost" onClick={() => openEdit(row)}>
                      Edit
                    </Button>
                    <Button
                      disabled={confirmState.isLoading}
                      onClick={async () => {
                        try {
                          const res = await act({ path: `admissions/${String(row._id)}/confirm` }).unwrap();
                          const payload = res.data as { studentCode?: string; password?: string; alreadyConfirmed?: boolean };
                          const base = {
                            name: String(row.name ?? ""),
                            phone: String(row.phone ?? ""),
                            parentPhone: String(row.parentPhone ?? ""),
                          };
                          if (payload.alreadyConfirmed) {
                            setIssued({
                              ...base,
                              studentCode: payload.studentCode ?? "",
                              password: "This admission was already confirmed. Reset password from Students if needed.",
                            });
                            toast("Admission already confirmed");
                          } else {
                            setIssued({
                              ...base,
                              studentCode: payload.studentCode ?? "",
                              password: payload.password ?? "",
                            });
                            toast("Credentials issued");
                          }
                          refetch();
                        } catch (err) {
                          toast((err as { data?: { message?: string } })?.data?.message ?? "Confirm failed", "error");
                        }
                      }}
                    >
                      Confirm & issue ID
                    </Button>
                  </>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal open={modalOpen} title={editing ? "Edit admission" : "New admission"} onClose={closeModal}>
        <form
          className="grid gap-3"
          onSubmit={form.handleSubmit(async (values) => {
            try {
              if (editRow) {
                await patch({
                  resource: "admissions",
                  id: String(editRow._id),
                  body: admissionBody(values, photo),
                }).unwrap();
                toast("Admission updated");
              } else {
                await create({ resource: "admissions", body: admissionBody(values, photo) }).unwrap();
                toast("Admission saved as draft");
              }
              closeModal();
              form.reset();
            } catch (err) {
              toast((err as { data?: { message?: string } })?.data?.message ?? "Save failed", "error");
            }
          })}
        >
          <AdmissionFields />
          <Button type="submit" disabled={createState.isLoading || patchState.isLoading}>
            {createState.isLoading || patchState.isLoading ? "Saving…" : editing ? "Update draft" : "Create draft"}
          </Button>
        </form>
      </Modal>

      <Modal open={Boolean(issued)} title="Credentials issued" onClose={() => setIssued(null)}>
        <p className="text-sm text-zinc-400">Share these once. The password is not stored in plain text after this response.</p>
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Student ID</p>
          <p className="mt-1 font-mono text-accent">{issued?.studentCode}</p>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Password</p>
          <p className="mt-1 font-mono break-all text-zinc-100">{issued?.password}</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="ghost"
            onClick={async () => {
              if (!issued) return;
              try {
                await navigator.clipboard.writeText(credentialsText(issued));
                toast("Credentials copied");
              } catch {
                toast("Copy failed", "error");
              }
            }}
          >
            Copy credentials
          </Button>
          {issued?.phone ? (
            <a
              href={whatsappLink(issued.phone, credentialsText(issued))}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-emerald-300 transition hover:bg-emerald-500/25"
            >
              WhatsApp · Student
            </a>
          ) : null}
          {issued?.parentPhone ? (
            <a
              href={whatsappLink(issued.parentPhone, credentialsText(issued))}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-emerald-300 transition hover:bg-emerald-500/25"
            >
              WhatsApp · Parent
            </a>
          ) : null}
        </div>
        <Button className="mt-4" onClick={() => setIssued(null)}>
          Done
        </Button>
      </Modal>
    </div>
  );
}
