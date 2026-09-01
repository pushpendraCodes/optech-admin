import { useNavigate, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { PageHeader, EmptyState, Skeleton, StatusBadge } from "@/components/Chrome";
import { Button } from "@/components/Button";
import { Input, Select } from "@/components/Field";
import { ConfirmDialog } from "@/components/Modal";
import { useActionMutation, useListQuery, usePatchMutation } from "@/app/api";
import { toast } from "@/components/Toast";
import { useCan } from "@/hooks/useAuth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { loc, rupees } from "@/utils/format";
import { feeReminderText, whatsappLink } from "@/utils/whatsapp";
import { StudentAvatar } from "@/components/StudentPhoto";

type FeesSummary = {
  totalDue?: number;
  totalOverdue?: number;
  nextDueDate?: string;
  nextDueAmount?: number;
};

function reminderPhone(row: Record<string, unknown>) {
  const parent = String(row.parentPhone ?? "").trim();
  if (parent) return parent;
  const user = row.user as { phone?: string } | undefined;
  return String(user?.phone ?? "").trim();
}

export function StudentsDesk() {
  const canBlock = useCan("student:block");
  const canUpdate = useCan("student:update");
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const debounced = useDebouncedValue(search);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(params.get("status") ?? "");
  const [courseFilter, setCourseFilter] = useState(params.get("course") ?? "");
  const [batchFilter, setBatchFilter] = useState(params.get("batch") ?? "");
  const [feesDueFilter, setFeesDueFilter] = useState(params.get("feesDue") ?? "");
  const [target, setTarget] = useState<{ id: string; block: boolean; code: string } | null>(null);
  const courses = useListQuery({ resource: "courses", page: 1 });
  const batches = useListQuery({ resource: "batches", page: 1, extra: { course: courseFilter } });
  const { data, isLoading, isError, refetch } = useListQuery({
    resource: "students",
    page,
    search: debounced,
    extra: { status, course: courseFilter, batch: batchFilter, feesDue: feesDueFilter },
  });
  const [act] = useActionMutation();
  const [patch] = usePatchMutation();
  const rows = data?.data ?? [];
  const meta = data?.meta;
  const courseRows = courses.data?.data ?? [];
  const batchRows = batches.data?.data ?? [];

  function updateParams(next: {
    q?: string;
    status?: string;
    course?: string;
    batch?: string;
    feesDue?: string;
  }) {
    const q = next.q ?? search;
    const s = next.status ?? status;
    const c = next.course ?? courseFilter;
    const b = next.batch ?? batchFilter;
    const f = next.feesDue ?? feesDueFilter;
    const entries: Record<string, string> = {};
    if (q) entries.q = q;
    if (s) entries.status = s;
    if (c) entries.course = c;
    if (b) entries.batch = b;
    if (f) entries.feesDue = f;
    setParams(entries, { replace: true });
  }

  return (
    <div>
      <PageHeader title="Students" description="Issued credentials only — no public self-register." />
      <div className="mb-4 grid gap-3 md:grid-cols-2 lg:grid-cols-5">
        <Input
          placeholder="Search student ID"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
            updateParams({ q: e.target.value });
          }}
        />
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
            updateParams({ status: e.target.value });
          }}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="blocked">Blocked</option>
        </Select>
        <Select
          value={feesDueFilter}
          onChange={(e) => {
            setFeesDueFilter(e.target.value);
            setPage(1);
            updateParams({ feesDue: e.target.value });
          }}
        >
          <option value="">All students</option>
          <option value="1">Fees due</option>
        </Select>
        <Select
          value={courseFilter}
          onChange={(e) => {
            setCourseFilter(e.target.value);
            setBatchFilter("");
            setPage(1);
            updateParams({ course: e.target.value, batch: "" });
          }}
        >
          <option value="">All courses</option>
          {courseRows.map((c) => (
            <option key={String(c._id)} value={String(c._id)}>
              {loc(c.title)}
            </option>
          ))}
        </Select>
        <Select
          value={batchFilter}
          onChange={(e) => {
            setBatchFilter(e.target.value);
            setPage(1);
            updateParams({ batch: e.target.value });
          }}
        >
          <option value="">All batches</option>
          {batchRows.map((b) => (
            <option key={String(b._id)} value={String(b._id)}>
              {String(b.label ?? b._id)}
            </option>
          ))}
        </Select>
      </div>
      {isLoading ? (
        <Skeleton className="h-48" />
      ) : isError ? (
        <EmptyState title="Could not load students" body="Confirm the API is running." action={<Button onClick={() => refetch()}>Retry</Button>} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No students"
          body={
            feesDueFilter
              ? "No students with outstanding fees match these filters."
              : courseFilter || batchFilter
                ? "No students match these filters."
                : "Confirm an admission to issue the first ID."
          }
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="border-b border-white/8 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              <tr>
                <th className="px-4 py-3 text-left">Photo</th>
                <th className="px-4 py-3 text-left">ID</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Batch</th>
                <th className="px-4 py-3 text-left">Fees due</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const id = String(row._id);
                const user = row.user as { name?: string; status?: string; phone?: string } | undefined;
                const rowBatch = row.batch as { label?: string; timing?: string } | undefined;
                const blocked = Boolean(row.blocked);
                const fees = (row.feesSummary as FeesSummary | undefined) ?? {};
                const totalDue = Number(fees.totalDue ?? 0);
                const phone = reminderPhone(row);
                const waHref =
                  totalDue > 0 && phone
                    ? whatsappLink(
                        phone,
                        feeReminderText({
                          name: user?.name ?? "Student",
                          studentCode: String(row.studentCode),
                          totalDue,
                          nextDueAmount: fees.nextDueAmount ? Number(fees.nextDueAmount) : undefined,
                          nextDueDate: fees.nextDueDate ? String(fees.nextDueDate) : undefined,
                        }),
                      )
                    : "";
                return (
                  <tr key={id} className="border-b border-white/5">
                    <td className="px-4 py-3">
                      <StudentAvatar photo={row.photo} name={user?.name} size="sm" />
                    </td>
                    <td className="px-4 py-3 font-mono text-accent">{String(row.studentCode)}</td>
                    <td className="px-4 py-3">{user?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      {rowBatch ? (
                        <>
                          <p>{rowBatch.label}</p>
                          {rowBatch.timing ? <p className="text-xs text-zinc-500">{rowBatch.timing}</p> : null}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {totalDue > 0 ? (
                        <div>
                          <p className="font-mono text-amber-300">{rupees(totalDue)}</p>
                          {Number(fees.totalOverdue ?? 0) > 0 ? (
                            <p className="text-xs text-red-300">{rupees(fees.totalOverdue)} overdue</p>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-zinc-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge value={blocked ? "blocked" : (user?.status ?? "active")} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button variant="ghost" onClick={() => navigate(`/students/${id}`)}>
                          {canUpdate ? "View / edit" : "Profile"}
                        </Button>
                        {waHref ? (
                          <a
                            href={waHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-9 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20"
                          >
                            WhatsApp
                          </a>
                        ) : null}
                        {canBlock ? (
                          <Button
                            variant={blocked ? "primary" : "danger"}
                            onClick={() => setTarget({ id, block: !blocked, code: String(row.studentCode) })}
                          >
                            {blocked ? "Unblock" : "Block"}
                          </Button>
                        ) : null}
                      </div>
                    </td>
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
      <ConfirmDialog
        open={Boolean(target)}
        title={target?.block ? "Block student?" : "Unblock student?"}
        body={`${target?.code} will ${target?.block ? "lose" : "regain"} portal access. The API remains authoritative.`}
        onClose={() => setTarget(null)}
        onConfirm={async () => {
          if (!target) return;
          try {
            if (target.block) await act({ path: `students/${target.id}/block` }).unwrap();
            else await patch({ resource: "students", id: `${target.id}/unblock`, body: {} }).unwrap();
            toast(target.block ? "Student blocked" : "Student unblocked");
            setTarget(null);
          } catch {
            toast("Update failed", "error");
          }
        }}
      />
    </div>
  );
}
