import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader, EmptyState, Skeleton, StatCard, StatusBadge } from "@/components/Chrome";
import { Button } from "@/components/Button";
import { Field, Input, Select, Textarea } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { StudentAvatar } from "@/components/StudentPhoto";
import { useCreateMutation, useListQuery } from "@/app/api";
import { toast } from "@/components/Toast";
import { useCan } from "@/hooks/useAuth";
import { isoDate, loc, rupees } from "@/utils/format";

const schema = z.object({
  student: z.string().min(1),
  amount: z.coerce.number().min(1),
  mode: z.enum(["cash", "upi", "razorpay"]),
  installment: z.string().optional(),
  notes: z.string().optional(),
});

type Form = z.infer<typeof schema>;

function paymentStudent(row: Record<string, unknown>) {
  return (row.student as Record<string, unknown> | undefined) ?? undefined;
}

function studentName(student: Record<string, unknown> | undefined) {
  const user = student?.user as { name?: string } | undefined;
  return user?.name ?? String(student?.studentCode ?? "");
}

function paymentNotes(row: Record<string, unknown>) {
  try {
    return JSON.parse(String(row.notes || "{}")) as {
      name?: string;
      email?: string;
      phone?: string;
      fee?: number;
      discount?: number;
      coupon?: string;
    };
  } catch {
    return {};
  }
}

function paymentDiscount(row: Record<string, unknown>) {
  const notes = paymentNotes(row);
  const listFee = Number(row.listFee ?? notes.fee ?? row.amount ?? 0);
  const discount = Number(row.discount ?? notes.discount ?? 0);
  const couponCode = String(row.couponCode || notes.coupon || "");
  return { listFee, discount, couponCode };
}

function payerName(row: Record<string, unknown>) {
  const student = paymentStudent(row);
  const fromStudent = studentName(student);
  if (fromStudent) return fromStudent;
  return String(row.payerName || paymentNotes(row).name || "Website payment");
}

export function FeesPage() {
  const canWrite = useCan("payment:write");
  const [status, setStatus] = useState("");
  const [studentFilter, setStudentFilter] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [modeFilter, setModeFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useListQuery({
    resource: "payments",
    page,
    extra: { status, studentId: studentFilter, courseId: courseFilter, mode: modeFilter },
  });
  const dues = useListQuery({ resource: "installments", page: 1, extra: { status: "due" } });
  const students = useListQuery({ resource: "students", page: 1 });
  const courses = useListQuery({ resource: "courses", page: 1 });
  const [create, createState] = useCreateMutation();
  const form = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { mode: "cash" } });
  const { setValue } = form;
  const selectedStudent = form.watch("student");
  const selectedInstallment = form.watch("installment");
  const amountValue = form.watch("amount");
  const studentInstallments = useListQuery(
    { resource: "installments", page: 1, limit: 50, extra: { studentId: selectedStudent } },
    { skip: !selectedStudent },
  );
  const pendingInstallments = useMemo(() => {
    const rows = studentInstallments.data?.data ?? [];
    return rows
      .filter((r) => r.status === "due" || r.status === "overdue")
      .sort((a, b) => new Date(String(a.dueDate)).getTime() - new Date(String(b.dueDate)).getTime());
  }, [studentInstallments.data?.data]);
  const selectedInstallmentRow = pendingInstallments.find((row) => String(row._id) === selectedInstallment);

  useEffect(() => {
    if (!selectedStudent) {
      setValue("installment", "");
      return;
    }
    const next = pendingInstallments[0];
    if (next) {
      setValue("installment", String(next._id));
      setValue("amount", Number(next.amount ?? 0));
    } else {
      setValue("installment", "");
    }
  }, [selectedStudent, pendingInstallments, setValue]);

  useEffect(() => {
    if (!selectedInstallment) return;
    const row = pendingInstallments.find((r) => String(r._id) === selectedInstallment);
    if (row) setValue("amount", Number(row.amount ?? 0));
  }, [selectedInstallment, pendingInstallments, setValue]);
  const rows = data?.data ?? [];
  const meta = data?.meta;
  const revenue = rows.filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.amount ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="Payments & fees"
        description="Razorpay and campus cash entries. Secrets never leave the API."
        actions={
          canWrite ? (
            <Button type="button" onClick={() => setOpen(true)}>
              Record payment
            </Button>
          ) : null
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <StatCard label="Loaded revenue" value={rupees(revenue)} />
        <StatCard label="Rows" value={meta?.totalItems ?? rows.length} />
        <StatCard label="Due installments" value={dues.data?.meta?.totalItems ?? dues.data?.data?.length ?? 0} />
        <StatCard label="Pending" value={rows.filter((p) => p.status === "pending" || p.status === "created").length} />
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">Student</span>
          <Select
            value={studentFilter}
            onChange={(e) => {
              setStudentFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All students</option>
            {(students.data?.data ?? []).map((s) => {
              const user = s.user as { name?: string } | undefined;
              return (
                <option key={String(s._id)} value={String(s._id)}>
                  {user?.name ? `${user.name} · ` : ""}
                  {String(s.studentCode)}
                </option>
              );
            })}
          </Select>
        </label>
        <label className="block">
          <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">Course</span>
          <Select
            value={courseFilter}
            onChange={(e) => {
              setCourseFilter(e.target.value);
              setPage(1);
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
          <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">Payment mode</span>
          <Select
            value={modeFilter}
            onChange={(e) => {
              setModeFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All modes</option>
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
            <option value="razorpay">Razorpay</option>
          </Select>
        </label>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {["", "paid", "pending", "failed", "refunded", "created"].map((s) => (
          <Button
            key={s || "all"}
            variant={status === s ? "primary" : "ghost"}
            onClick={() => {
              setStatus(s);
              setPage(1);
            }}
          >
            {s || "all"}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-48" />
      ) : isError ? (
        <EmptyState title="Could not load payments" body="Retry after connecting the API." action={<Button onClick={() => refetch()}>Retry</Button>} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No payments"
          body={studentFilter || courseFilter || modeFilter ? "No payments match these filters." : "Record a campus cash entry or wait for Razorpay webhooks."}
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="border-b border-white/8 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              <tr>
                <th className="px-4 py-3 text-left">Student</th>
                <th className="px-4 py-3 text-left">Admission</th>
                <th className="px-4 py-3 text-left">Course</th>
                <th className="px-4 py-3 text-left">Amount</th>
                <th className="px-4 py-3 text-left">Discount</th>
                <th className="px-4 py-3 text-left">Coupon</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Mode</th>
                <th className="px-4 py-3 text-left">Order</th>
                <th className="px-4 py-3 text-left">Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const student = paymentStudent(row);
                const notes = paymentNotes(row);
                const { discount, couponCode } = paymentDiscount(row);
                const name = payerName(row);
                const phone = student
                  ? undefined
                  : String(row.payerPhone || notes.phone || "");
                return (
                  <tr key={String(row._id)} className="border-b border-white/5">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <StudentAvatar photo={student?.photo} name={name} size="sm" />
                        <div>
                          <p className="font-medium">{name}</p>
                          {student?.studentCode ? (
                            <p className="font-mono text-xs text-accent">{String(student.studentCode)}</p>
                          ) : phone ? (
                            <p className="text-xs text-zinc-500">{phone}</p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge value={student?.studentCode ? "admitted" : "not admitted"} />
                    </td>
                    <td className="px-4 py-3">{loc((row.course as { title?: unknown } | undefined)?.title) || "—"}</td>
                    <td className="px-4 py-3">{rupees(row.amount)}</td>
                    <td className="px-4 py-3">
                      {discount > 0 ? (
                        <span className="text-emerald-300">{rupees(discount)}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {couponCode ? (
                        <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-accent">{couponCode}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge value={String(row.status)} />
                    </td>
                    <td className="px-4 py-3 capitalize">{String(row.mode)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{String(row.razorpayOrderId ?? "—")}</td>
                    <td className="px-4 py-3 text-zinc-400">{isoDate(String(row.createdAt ?? ""))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
        <span>
          Page {meta?.currentPage ?? page} of {meta?.totalPages ?? 1}
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Prev
          </Button>
          <Button variant="ghost" disabled={(meta?.currentPage ?? 1) >= (meta?.totalPages ?? 1)} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      </div>

      <Modal open={open} title="Manual payment" onClose={() => setOpen(false)}>
        <form
          className="grid gap-3"
          onSubmit={form.handleSubmit(async (values) => {
            try {
              await create({
                resource: "payments/manual",
                body: {
                  student: values.student,
                  amount: values.amount,
                  mode: values.mode,
                  notes: values.notes,
                  installment: values.installment || undefined,
                },
              }).unwrap().then((res) => {
                const allocation = (res.data as { allocation?: { partsPaid?: number; remainingCredit?: number } })?.allocation;
                if (allocation?.partsPaid && allocation.partsPaid > 1) {
                  toast(`Payment recorded · ${allocation.partsPaid} installments marked paid`);
                } else if (allocation?.remainingCredit && allocation.remainingCredit > 0) {
                  toast(`Payment recorded · ${rupees(allocation.remainingCredit)} extra after dues cleared`);
                } else {
                  toast("Payment recorded");
                }
              });
              setOpen(false);
              form.reset({ mode: "cash" });
            } catch {
              toast("Save failed", "error");
            }
          })}
        >
          <Field label="Student" error={form.formState.errors.student?.message}>
            <Select {...form.register("student")}>
              <option value="">Select</option>
              {(students.data?.data ?? []).map((s) => {
                const user = s.user as { name?: string } | undefined;
                return (
                  <option key={String(s._id)} value={String(s._id)}>
                    {user?.name ? `${user.name} · ` : ""}
                    {String(s.studentCode)}
                  </option>
                );
              })}
            </Select>
          </Field>
          {selectedStudent ? (
            <Field label="Installment">
              {pendingInstallments.length === 0 ? (
                <p className="text-xs text-zinc-500">No pending installments for this student.</p>
              ) : (
                <Select {...form.register("installment")}>
                  {pendingInstallments.map((row) => (
                    <option key={String(row._id)} value={String(row._id)}>
                      Part {String(row.sequence ?? "—")} · due {isoDate(String(row.dueDate))} · {rupees(row.amount)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          ) : null}
          <Field label="Amount">
            <Input type="number" {...form.register("amount")} />
            {selectedInstallmentRow && Number(amountValue) > Number(selectedInstallmentRow.amount ?? 0) ? (
              <p className="mt-1 text-xs text-zinc-500">
                Extra amount will auto-apply to the next pending installment(s).
              </p>
            ) : null}
          </Field>
          <Field label="Mode">
            <Select {...form.register("mode")}>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="razorpay">Razorpay</option>
            </Select>
          </Field>
          <Field label="Notes">
            <Textarea {...form.register("notes")} />
          </Field>
          <Button type="submit" disabled={createState.isLoading}>
            {createState.isLoading ? "Saving…" : "Save"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
