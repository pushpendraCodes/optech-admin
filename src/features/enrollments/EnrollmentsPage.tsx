import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader, EmptyState, Skeleton, StatusBadge } from "@/components/Chrome";
import { Button } from "@/components/Button";
import { Field, Input, Select, Textarea } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { PhotoUploadField, StudentAvatar, type PhotoAsset } from "@/components/StudentPhoto";
import { useActionMutation, useListQuery } from "@/app/api";
import { toast } from "@/components/Toast";
import { useCan } from "@/hooks/useAuth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { isoDate, loc, rupees } from "@/utils/format";

const admitSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().min(8, "Phone is required"),
  course: z.string().min(1, "Select a course"),
  batch: z.string().optional(),
  parentPhone: z.string().optional(),
  address: z.string().optional(),
  dob: z.string().optional(),
  referrerCode: z.string().optional(),
});

type AdmitForm = z.infer<typeof admitSchema>;

type IssuedCredentials = {
  studentCode: string;
  password: string;
  name?: string;
  phone?: string;
};

function studentFromRow(row: Record<string, unknown>) {
  return (row.student as Record<string, unknown> | undefined) ?? undefined;
}

function payerFromRow(row: Record<string, unknown>) {
  const student = studentFromRow(row);
  const user = student?.user as { name?: string; phone?: string; email?: string } | undefined;
  const payer = row.payer as { name?: string; phone?: string; email?: string } | undefined;
  return {
    name: user?.name || payer?.name || String(row.payerName ?? ""),
    phone: user?.phone || payer?.phone || String(row.payerPhone ?? ""),
    email: user?.email || payer?.email || String(row.payerEmail ?? ""),
  };
}

function credentialsText(c: IssuedCredentials) {
  return [
    `Optech admission confirmed${c.name ? ` for ${c.name}` : ""}.`,
    "",
    `Student ID: ${c.studentCode}`,
    `Password: ${c.password}`,
    "",
    "Login at the student portal and change your password after first sign-in.",
  ].join("\n");
}

function whatsappDigits(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export function EnrollmentsPage() {
  const canAdmit = useCan("admission:write");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const { data, isLoading, isError, refetch } = useListQuery({
    resource: "enrollments",
    page,
    search: debouncedSearch,
    extra: { status },
  });
  const [admit, admitState] = useActionMutation();
  const [row, setRow] = useState<Record<string, unknown> | null>(null);
  const [photo, setPhoto] = useState<PhotoAsset | null>(null);
  const [issued, setIssued] = useState<IssuedCredentials | null>(null);
  const form = useForm<AdmitForm>({ resolver: zodResolver(admitSchema) });
  const selectedCourseId = form.watch("course");
  const courses = useListQuery({ resource: "courses", page: 1, limit: 100 });
  const batches = useListQuery(
    { resource: "batches", page: 1, extra: { course: selectedCourseId || "" } },
    { skip: !row || !selectedCourseId },
  );
  const courseBatches = batches.data?.data ?? [];
  const rows = data?.data ?? [];
  const meta = data?.meta;

  useEffect(() => {
    if (!row || batches.isLoading || courseBatches.length === 0) return;
    const current = form.getValues("batch");
    if (current && courseBatches.some((b) => String(b._id) === current)) return;
    form.setValue("batch", String(courseBatches[0]._id));
  }, [row, courseBatches, batches.isLoading, form]);

  function openAdmit(next: Record<string, unknown>) {
    const student = studentFromRow(next);
    const payer = payerFromRow(next);
    const application = (next.application as Record<string, string> | undefined) ?? {};
    const courseId = String(
      application.courseId || (next.course as { _id?: string } | undefined)?._id || next.course || "",
    );
    const notes = (() => {
      try {
        return JSON.parse(String(next.notes || "{}")) as { batchId?: string; referralCode?: string };
      } catch {
        return {};
      }
    })();
    setRow(next);
    setPhoto((student?.photo as PhotoAsset | undefined) ?? null);
    form.reset({
      name: payer.name,
      email: payer.email,
      phone: payer.phone,
      course: courseId,
      batch: String(application.batchId || notes.batchId || ""),
      parentPhone: String(student?.parentPhone ?? ""),
      address: String(student?.address ?? ""),
      dob: student?.dob ? isoDate(String(student.dob)) : "",
      referrerCode: String(application.referralCode || notes.referralCode || ""),
    });
  }

  return (
    <div>
      <PageHeader
        title="Website enrollments"
        description="Paid website applications. They are not students until you admit them here."
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { key: "", label: "all paid" },
          { key: "pending", label: "pending admit" },
          { key: "admitted", label: "admitted" },
        ].map((item) => (
          <Button
            key={item.key || "all"}
            variant={status === item.key ? "primary" : "ghost"}
            onClick={() => {
              setStatus(item.key);
              setPage(1);
            }}
          >
            {item.label}
          </Button>
        ))}
      </div>
      <div className="mb-4">
        <Input
          placeholder="Search name, phone, email, or student ID"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>
      {isLoading ? (
        <Skeleton className="h-40" />
      ) : isError ? (
        <EmptyState title="Could not load enrollments" body="Retry after the API is up." action={<Button onClick={() => refetch()}>Retry</Button>} />
      ) : rows.length === 0 ? (
        <EmptyState title="No website enrollments" body="Paid website checkouts appear here so you can admit the student." />
      ) : (
        <div className="grid gap-3">
          {rows.map((item) => {
            const payer = payerFromRow(item);
            const student = studentFromRow(item);
            const payment = (item.payment as { amount?: number; mode?: string; createdAt?: string } | undefined) ?? item;
            const admitted = String(item.admissionStatus) === "admitted";
            return (
              <article key={String(item._id)} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <StudentAvatar photo={student?.photo} name={payer.name} size="md" />
                  <div>
                    <p className="font-semibold">{payer.name || "—"}</p>
                    <p className="text-sm text-zinc-400">
                      {payer.phone || "—"} · {payer.email || "no email"}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {loc((item.course as { title?: unknown })?.title) || "Course"} · {String(item.feePlan ?? "full")}
                      {student?.studentCode ? ` · ${String(student.studentCode)}` : " · not a student yet"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-right text-sm">
                    <p className="font-mono text-accent">{rupees(payment?.amount)}</p>
                    <p className="text-xs text-zinc-500">
                      {payment?.mode ?? "online"} · {payment?.createdAt ? isoDate(String(payment.createdAt)) : ""}
                    </p>
                  </div>
                  <StatusBadge value={admitted ? "admitted" : "pending"} />
                  {!admitted && canAdmit ? (
                    <Button onClick={() => openAdmit(item)}>Admit student</Button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
      {meta ? (
        <div className="mt-4 flex items-center justify-between text-xs text-zinc-500">
          <span>
            Page {meta.currentPage} of {meta.totalPages} · {meta.totalItems} items
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Prev
            </Button>
            <Button
              variant="ghost"
              disabled={(meta.currentPage ?? 1) >= (meta.totalPages ?? 1)}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      <Modal open={Boolean(row)} title="Admit website student" onClose={() => setRow(null)}>
        <form
          className="grid gap-3"
          onSubmit={form.handleSubmit(async (values) => {
            if (!row) return;
            try {
              const res = await admit({
                path: `enrollments/${String(row._id)}/admit`,
                body: {
                  ...values,
                  email: values.email || undefined,
                  course: values.course || undefined,
                  batch: values.batch || undefined,
                  referrerCode: values.referrerCode?.trim().toUpperCase() || undefined,
                  photo: photo ?? undefined,
                },
              }).unwrap();
              const payload = res.data as { studentCode?: string; password?: string; alreadyAdmitted?: boolean };
              if (payload.alreadyAdmitted) {
                toast("Already admitted");
              } else if (payload.password) {
                setIssued({
                  studentCode: payload.studentCode ?? "",
                  password: payload.password,
                  name: values.name,
                  phone: values.phone,
                });
                toast("Student admitted");
              } else {
                toast("Student admitted");
              }
              setRow(null);
              refetch();
            } catch (err) {
              toast((err as { data?: { message?: string } })?.data?.message ?? "Admit failed", "error");
            }
          })}
        >
          <p className="text-sm text-zinc-400">
            Details from the website form are filled in. Edit anything that is wrong, then mark admitted.
          </p>
          <PhotoUploadField value={photo} onChange={setPhoto} />
          <Field label="Name" error={form.formState.errors.name?.message}>
            <Input {...form.register("name")} />
          </Field>
          <Field label="Phone" error={form.formState.errors.phone?.message}>
            <Input {...form.register("phone")} />
          </Field>
          <Field label="Email" error={form.formState.errors.email?.message}>
            <Input type="email" {...form.register("email")} />
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
            <Select {...form.register("batch")} disabled={!selectedCourseId || batches.isLoading}>
              <option value="">
                {!selectedCourseId ? "Select a course first" : batches.isLoading ? "Loading batches…" : courseBatches.length ? "Select batch" : "No batches for this course"}
              </option>
              {courseBatches.map((b) => (
                <option key={String(b._id)} value={String(b._id)}>
                  {String(b.label ?? b._id)}
                  {b.timing ? ` · ${String(b.timing)}` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Parent / guardian number">
            <Input placeholder="Optional" {...form.register("parentPhone")} />
          </Field>
          <Field label="Date of birth">
            <Input type="date" {...form.register("dob")} />
          </Field>
          <Field label="Address">
            <Textarea placeholder="Optional campus details" {...form.register("address")} />
          </Field>
          <Field label="Referral code">
            <Input placeholder="From website, if they used one" {...form.register("referrerCode")} />
          </Field>
          <Button type="submit" disabled={admitState.isLoading}>
            {admitState.isLoading ? "Admitting…" : "Mark admitted"}
          </Button>
        </form>
      </Modal>

      <Modal open={Boolean(issued)} title="Credentials issued" onClose={() => setIssued(null)}>
        <p className="text-sm text-zinc-400">Share these once. The password is not stored in plain text after this.</p>
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
              href={`https://wa.me/${whatsappDigits(issued.phone)}?text=${encodeURIComponent(credentialsText(issued))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-emerald-300 transition hover:bg-emerald-500/25"
            >
              WhatsApp
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
