import { useParams, useNavigate } from "react-router-dom";
import { PageHeader, Skeleton, StatusBadge, EmptyState, StatCard } from "@/components/Chrome";
import { Button } from "@/components/Button";
import { useGetByIdQuery, useIssueCertificateMutation, useDownloadCertificatePdfMutation, useDownloadIdCardPdfMutation } from "@/app/api";
import { toast } from "@/components/Toast";
import { downloadBlob } from "@/utils/downloadBlob";
import { isoDate, loc, rupees } from "@/utils/format";
import { StudentAttendanceSection } from "./StudentAttendanceSection";
import { StudentManageActions } from "./StudentManageActions";
import { StudentAvatar } from "@/components/StudentPhoto";

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-white/5 py-2 last:border-0">
      <dt className="shrink-0 text-zinc-500">{label}</dt>
      <dd className="text-right text-zinc-100">{value}</dd>
    </div>
  );
}

function courseTitle(course: unknown) {
  if (course && typeof course === "object" && "title" in (course as object)) return loc((course as { title: unknown }).title);
  return "—";
}

function paymentDiscount(row: Record<string, unknown>) {
  try {
    const notes = JSON.parse(String(row.notes || "{}")) as { fee?: number; discount?: number; coupon?: string };
    const discount = Number(row.discount ?? notes.discount ?? 0);
    const couponCode = String(row.couponCode || notes.coupon || "");
    return { discount, couponCode };
  } catch {
    return { discount: 0, couponCode: "" };
  }
}

export function StudentDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [issueCertificate] = useIssueCertificateMutation();
  const [downloadCertificate] = useDownloadCertificatePdfMutation();
  const [downloadIdCard] = useDownloadIdCardPdfMutation();
  const { data, isLoading, isError, refetch } = useGetByIdQuery({ resource: "students", id }, { skip: !id });
  const payload = data?.data as Record<string, unknown> | undefined;
  const student = payload?.student as Record<string, unknown> | undefined;
  const user = student?.user as { name?: string; email?: string; phone?: string; status?: string; lastLoginAt?: string } | undefined;
  const batch = student?.batch as { label?: string; timing?: string; seats?: number; start?: string } | undefined;
  const admission = payload?.admission as Record<string, unknown> | null | undefined;
  const enrollments = (payload?.enrollments as Record<string, unknown>[] | undefined) ?? [];
  const certificates = (payload?.certificates as Record<string, unknown>[] | undefined) ?? [];
  const certByEnrollment = new Map(
    certificates.map((row) => [String(row.enrollment), row]),
  );
  const installments = (payload?.installments as Record<string, unknown>[] | undefined) ?? [];
  const payments = (payload?.payments as Record<string, unknown>[] | undefined) ?? [];
  const attendance = payload?.attendance as
    | { present?: number; absent?: number; late?: number; total?: number; percent?: number; recent?: Record<string, unknown>[] }
    | undefined;
  const fees = payload?.fees as
    | {
        totalPaid?: number;
        totalDue?: number;
        installmentDue?: number;
        fullFeeDue?: number;
        totalOverdue?: number;
        nextDueDate?: string;
        nextDueAmount?: number;
        nextDueKind?: "installment" | "full";
        fullFeeItems?: {
          enrollmentId?: string;
          course?: { title?: unknown };
          courseFee?: number;
          listFee?: number;
          discount?: number;
          couponCode?: string;
          agreedFee?: number;
          paid?: number;
          due?: number;
        }[];
      }
    | undefined;

  if (isLoading) return <Skeleton className="h-64" />;
  if (isError || !student) {
    return <EmptyState title="Student not found" body="The ID may be invalid." action={<Button onClick={() => refetch()}>Retry</Button>} />;
  }

  const dueInstallments = installments.filter((i) => i.status === "due" || i.status === "overdue");
  const paidInstallments = installments.filter((i) => i.status === "paid");
  const fullFeeItems = fees?.fullFeeItems ?? [];
  const hasFullFeeDue = (fees?.fullFeeDue ?? 0) > 0;
  const discountedItems = fullFeeItems.filter((item) => (item.discount ?? 0) > 0);
  const feePlanFull = String(admission?.feePlan ?? "") === "full";
  const sortedInstallments = [...installments].sort(
    (a, b) => new Date(String(a.dueDate)).getTime() - new Date(String(b.dueDate)).getTime(),
  );

  return (
    <div>
      <PageHeader
        title={user?.name ?? String(student.studentCode)}
        description={`${student.studentCode} · full profile, courses, fees & attendance`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => navigate("/students")}>
              Back
            </Button>
            <StudentManageActions
              studentId={id}
              student={student}
              user={user}
              enrollments={enrollments}
              onUpdated={() => refetch()}
            />
            <Button
              onClick={async () => {
                try {
                  const blob = await downloadIdCard(id).unwrap();
                  downloadBlob(blob, `${String(student.studentCode)}-id.pdf`);
                } catch {
                  toast("ID card download failed", "error");
                }
              }}
            >
              Download ID
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Student ID" value={String(student.studentCode)} />
        <StatCard label="Attendance" value={`${attendance?.percent ?? 0}%`} />
        <StatCard label="Fees due" value={rupees(fees?.totalDue ?? 0)} />
        <StatCard label="Total paid" value={rupees(fees?.totalPaid ?? 0)} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <article className="card p-5">
          <div className="mb-4 flex items-center gap-4">
            <StudentAvatar photo={student.photo} name={user?.name} size="lg" />
            <div>
              <h2 className="font-sans text-lg font-semibold">{user?.name ?? String(student.studentCode)}</h2>
              <p className="text-sm text-zinc-500">{String(student.studentCode)}</p>
            </div>
          </div>
          <h2 className="mb-3 font-sans text-base font-semibold text-zinc-300">Personal details</h2>
          <dl className="text-sm">
            <DetailRow label="Email" value={user?.email ?? "—"} />
            <DetailRow label="Phone" value={user?.phone ?? "—"} />
            <DetailRow label="Parent phone" value={String(student.parentPhone ?? "—")} />
            <DetailRow label="Date of birth" value={student.dob ? isoDate(String(student.dob)) : "—"} />
            <DetailRow label="Address" value={String(student.address ?? "—")} />
            <DetailRow label="Roll number" value={String(student.rollNumber ?? "—")} />
            <DetailRow label="Referral code" value={String(student.referralCode ?? "—")} />
            <DetailRow label="Valid till" value={student.validTill ? isoDate(String(student.validTill)) : "—"} />
            <DetailRow
              label="Account"
              value={<StatusBadge value={student.blocked ? "blocked" : (user?.status ?? "active")} />}
            />
            {user?.lastLoginAt ? <DetailRow label="Last login" value={isoDate(String(user.lastLoginAt))} /> : null}
          </dl>
        </article>

        <article className="card p-5">
          <h2 className="mb-3 font-sans text-lg font-semibold">Assigned batch</h2>
          {batch ? (
            <dl className="text-sm">
              <DetailRow label="Batch" value={String(batch.label ?? "—")} />
              <DetailRow label="Timing" value={String(batch.timing ?? "—")} />
              <DetailRow label="Seats" value={String(batch.seats ?? "—")} />
              <DetailRow label="Starts" value={batch.start ? isoDate(String(batch.start)) : "—"} />
            </dl>
          ) : (
            <p className="text-sm text-zinc-500">No primary batch assigned on the student record.</p>
          )}
          {admission ? (
            <div className="mt-4 border-t border-white/8 pt-4">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Admission record</p>
              <dl className="text-sm">
                <DetailRow label="Course" value={courseTitle(admission.course)} />
                <DetailRow label="Fee plan" value={String(admission.feePlan ?? "—")} />
                <DetailRow label="Payment mode" value={String(admission.paymentMode ?? "—")} />
                <DetailRow label="Status" value={<StatusBadge value={String(admission.status)} />} />
              </dl>
            </div>
          ) : null}
        </article>
      </div>

      <article className="card mt-4 p-5">
        <h2 className="mb-3 font-sans text-lg font-semibold">Enrolled courses</h2>
        {enrollments.length === 0 ? (
          <p className="text-sm text-zinc-500">No enrollments yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-white/8 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                <tr>
                  <th className="px-3 py-2 text-left">Course</th>
                  <th className="px-3 py-2 text-left">Batch</th>
                  <th className="px-3 py-2 text-left">Fee</th>
                  <th className="px-3 py-2 text-left">Plan</th>
                  <th className="px-3 py-2 text-left">Progress</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Certificate</th>
                </tr>
              </thead>
              <tbody>
                {enrollments.map((row) => {
                  const enrollmentId = String(row._id);
                  const cert = certByEnrollment.get(enrollmentId);
                  const course = row.course as { fee?: number; duration?: string; mode?: string } | undefined;
                  const rowBatch = row.batch as { label?: string; timing?: string } | undefined;
                  const feeItem = fullFeeItems.find((item) => item.enrollmentId === String(row._id));
                  const discount = Number(row.discount ?? feeItem?.discount ?? 0);
                  const agreedFee = Number(row.agreedFee ?? feeItem?.agreedFee ?? course?.fee ?? 0);
                  return (
                    <tr key={String(row._id)} className="border-b border-white/5">
                      <td className="px-3 py-3">
                        <p className="font-medium">{courseTitle(row.course)}</p>
                        <p className="text-xs text-zinc-500">
                          {course?.duration ?? "—"} · {course?.mode ?? "—"}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        {rowBatch ? (
                          <>
                            <p>{rowBatch.label}</p>
                            <p className="text-xs text-zinc-500">{rowBatch.timing}</p>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {discount > 0 ? (
                          <div>
                            <p>{rupees(agreedFee)}</p>
                            <p className="text-xs text-zinc-500 line-through">{rupees(course?.fee ?? 0)}</p>
                            {(row.couponCode || feeItem?.couponCode) ? (
                              <p className="mt-1 font-mono text-[10px] text-accent">{String(row.couponCode || feeItem?.couponCode)}</p>
                            ) : null}
                          </div>
                        ) : (
                          rupees(course?.fee ?? 0)
                        )}
                      </td>
                      <td className="px-3 py-3">{String(row.feePlan ?? "—")}</td>
                      <td className="px-3 py-3">{String(row.progress ?? 0)}%</td>
                      <td className="px-3 py-3">
                        <StatusBadge value={String(row.status)} />
                      </td>
                      <td className="px-3 py-3">
                        {cert ? (
                          <div className="flex flex-col gap-1.5">
                            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-emerald-300">
                              Issued {cert.issuedAt ? isoDate(String(cert.issuedAt)) : ""}
                            </span>
                            <Button
                              variant="ghost"
                              className="h-8 px-2 text-xs"
                              onClick={async () => {
                                try {
                                  const blob = await downloadCertificate(enrollmentId).unwrap();
                                  downloadBlob(
                                    blob,
                                    `${String(student.studentCode)}-${enrollmentId.slice(-6)}-certificate.pdf`,
                                  );
                                } catch {
                                  toast("Certificate download failed", "error");
                                }
                              }}
                            >
                              Download
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            className="h-8 px-2 text-xs"
                            onClick={async () => {
                              try {
                                await issueCertificate({ enrollmentId, studentId: id }).unwrap();
                                toast("Certificate generated", "ok");
                                refetch();
                              } catch {
                                toast("Could not generate certificate", "error");
                              }
                            }}
                          >
                            Generate
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <article className="card p-5">
          <h2 className="mb-3 font-sans text-lg font-semibold">Fees & installments</h2>
          <dl className="mb-4 text-sm">
            <DetailRow label="Total paid" value={rupees(fees?.totalPaid ?? 0)} />
            {discountedItems.length ? (
              <DetailRow
                label="Scholarship / coupon"
                value={
                  <span className="text-emerald-300">
                    {discountedItems.map((item) => (
                      <span key={String(item.enrollmentId)} className="block">
                        {rupees(item.discount ?? 0)} off
                        {item.couponCode ? ` · ${item.couponCode}` : ""}
                      </span>
                    ))}
                  </span>
                }
              />
            ) : null}
            <DetailRow label="Outstanding" value={rupees(fees?.totalDue ?? 0)} />
            {hasFullFeeDue ? (
              <DetailRow label="Full fee due" value={rupees(fees?.fullFeeDue ?? 0)} />
            ) : null}
            {(fees?.installmentDue ?? 0) > 0 ? (
              <DetailRow label="Installment due" value={rupees(fees?.installmentDue ?? 0)} />
            ) : null}
            <DetailRow label="Overdue" value={rupees(fees?.totalOverdue ?? 0)} />
            <DetailRow
              label="Installments"
              value={
                sortedInstallments.length
                  ? `${paidInstallments.length} paid · ${dueInstallments.length} pending`
                  : feePlanFull && hasFullFeeDue
                    ? "Full payment plan"
                    : "—"
              }
            />
            <DetailRow
              label="Next due"
              value={
                fees?.nextDueKind === "full" && fees?.nextDueAmount
                  ? `${rupees(fees.nextDueAmount)} · full course fee`
                  : fees?.nextDueDate
                    ? `${rupees(fees.nextDueAmount ?? 0)} on ${isoDate(String(fees.nextDueDate))}`
                    : hasFullFeeDue
                      ? `${rupees(fees?.fullFeeDue ?? 0)} · full course fee unpaid`
                      : "—"
              }
            />
          </dl>
          {hasFullFeeDue ? (
            <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-200">Full fee outstanding</p>
              <ul className="mt-2 space-y-2 text-sm">
                {fullFeeItems.filter((item) => (item.due ?? 0) > 0).map((item) => (
                  <li key={String(item.enrollmentId ?? item.courseFee)} className="flex items-center justify-between gap-3">
                    <span>{loc(item.course?.title) || "Course"}</span>
                    <span className="text-right">
                      <span className="font-mono text-amber-200">{rupees(item.due ?? 0)} due</span>
                      <span className="block text-xs text-zinc-500">
                        {rupees(item.paid ?? 0)} paid of {rupees(item.agreedFee ?? item.courseFee ?? 0)}
                        {(item.discount ?? 0) > 0 ? ` · ${rupees(item.discount ?? 0)} coupon off` : ""}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : discountedItems.some((item) => (item.paid ?? 0) >= (item.agreedFee ?? 0)) ? (
            <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-emerald-200">Coupon applied</p>
              <ul className="mt-2 space-y-2 text-sm">
                {discountedItems.map((item) => (
                  <li key={String(item.enrollmentId ?? item.courseFee)} className="flex items-center justify-between gap-3">
                    <span>{loc(item.course?.title) || "Course"}</span>
                    <span className="text-right text-emerald-200">
                      {rupees(item.discount ?? 0)} off
                      {item.couponCode ? ` · ${item.couponCode}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {sortedInstallments.length === 0 ? (
            hasFullFeeDue ? (
              <p className="text-sm text-amber-200">Full fee plan — record payment from Fees when the student pays.</p>
            ) : (
              <p className="text-sm text-zinc-500">No installments scheduled.</p>
            )
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead className="border-b border-white/8 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                  <tr>
                    <th className="px-2 py-2 text-left">Part</th>
                    <th className="px-2 py-2 text-left">Due date</th>
                    <th className="px-2 py-2 text-left">Amount</th>
                    <th className="px-2 py-2 text-left">Status</th>
                    <th className="px-2 py-2 text-left">Paid on</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedInstallments.map((row) => {
                    const payment = row.payment as { createdAt?: string } | undefined;
                    return (
                      <tr key={String(row._id)} className="border-b border-white/5">
                        <td className="px-2 py-2">#{String(row.sequence ?? "—")}</td>
                        <td className="px-2 py-2">{row.dueDate ? isoDate(String(row.dueDate)) : "—"}</td>
                        <td className="px-2 py-2">{rupees(row.amount)}</td>
                        <td className="px-2 py-2">
                          <StatusBadge value={String(row.status)} />
                        </td>
                        <td className="px-2 py-2 text-zinc-400">
                          {row.status === "paid" && payment?.createdAt ? isoDate(String(payment.createdAt)) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {dueInstallments.length > 0 ? (
            <p className="mt-3 text-xs text-zinc-500">
              {dueInstallments.length} pending installment{dueInstallments.length === 1 ? "" : "s"}.
            </p>
          ) : sortedInstallments.length > 0 ? (
            <p className="mt-3 text-xs text-emerald-400">All installments paid.</p>
          ) : hasFullFeeDue ? (
            <p className="mt-3 text-xs text-amber-300">Full course fee not yet paid in full.</p>
          ) : feePlanFull && (fees?.totalPaid ?? 0) > 0 ? (
            <p className="mt-3 text-xs text-emerald-400">Full course fee paid.</p>
          ) : null}
        </article>

        <article className="card p-5">
          <h2 className="mb-3 font-sans text-lg font-semibold">Payment history</h2>
          {payments.length === 0 ? (
            <p className="text-sm text-zinc-500">No payments recorded.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {payments.map((row) => {
                const { discount, couponCode } = paymentDiscount(row);
                return (
                <li key={String(row._id)} className="flex items-center justify-between border-t border-white/8 pt-2">
                  <div>
                    <p>{courseTitle(row.course)}</p>
                    <p className="text-xs text-zinc-500">
                      {isoDate(String(row.createdAt ?? ""))} · {String(row.mode ?? "—")}
                      {couponCode ? ` · ${couponCode}` : ""}
                    </p>
                    {discount > 0 ? (
                      <p className="text-xs text-emerald-400">{rupees(discount)} scholarship / coupon discount</p>
                    ) : null}
                  </div>
                  <span className="flex items-center gap-2">
                    <StatusBadge value={String(row.status)} />
                    {rupees(row.amount)}
                  </span>
                </li>
              );
              })}
            </ul>
          )}
        </article>
      </div>

      <StudentAttendanceSection studentId={id} enrollments={enrollments} />
    </div>
  );
}
