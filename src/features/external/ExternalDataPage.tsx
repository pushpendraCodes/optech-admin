import { useRef, useState } from "react";
import { PageHeader, EmptyState, Skeleton } from "@/components/Chrome";
import { Button } from "@/components/Button";
import { Field, Input, Select } from "@/components/Field";
import { ConfirmDialog } from "@/components/Modal";
import { useActionMutation, useListQuery, useRemoveMutation } from "@/app/api";
import { toast } from "@/components/Toast";
import { useCan } from "@/hooks/useAuth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { ExternalEditorModal, type ExternalRow } from "./ExternalEditorModal";
import { downloadExternalTemplate, parseExternalImportFile } from "./utils/externalExcel";

function money(v?: number) {
  if (v == null || Number.isNaN(Number(v))) return "—";
  return Number(v).toLocaleString("en-IN");
}

function instCell(row: ExternalRow, index: number) {
  const item = row.installments?.[index];
  if (!item?.amount && !item?.date) return "—";
  return `${item.amount != null ? money(item.amount) : "—"}${item.date ? ` · ${item.date}` : ""}`;
}

export function ExternalDataPage() {
  const canWrite = useCan("admission:write");
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [course, setCourse] = useState("");
  const [sessionLabel, setSessionLabel] = useState("");
  const [page, setPage] = useState(1);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editRow, setEditRow] = useState<ExternalRow | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const debounced = useDebouncedValue(search);

  const extra: Record<string, string> = {};
  if (course) extra.course = course;
  if (sessionLabel) extra.sessionLabel = sessionLabel;

  const { data, isLoading, isError, refetch } = useListQuery({
    resource: "external-admissions",
    page,
    limit: 20,
    search: debounced,
    extra,
  });
  const [remove, removeState] = useRemoveMutation();
  const [act] = useActionMutation();

  const rows = (data?.data ?? []) as ExternalRow[];
  const meta = data?.meta;

  async function onImportFile(file: File) {
    setImporting(true);
    try {
      const parsed = await parseExternalImportFile(file);
      if (!parsed.rows.length) {
        toast("No valid student rows found in the sheet", "error");
        return;
      }
      const res = await act({
        path: "external-admissions/import",
        body: {
          rows: parsed.rows,
          sessionLabel: parsed.sessionLabel || sessionLabel || "ADMISSION-2026",
          programLabel: parsed.programLabel || "MS-CIT + KLiC",
        },
      }).unwrap();
      const count = Number((res.data as { imported?: number } | undefined)?.imported ?? parsed.rows.length);
      toast(`Imported ${count} record(s)`);
      setPage(1);
      refetch();
    } catch (err) {
      toast((err as { data?: { message?: string } })?.data?.message ?? "Import failed", "error");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div>
      <PageHeader
        title="External data management"
        description="Upload MS-CIT + KLiC admission Excel sheets, or add / edit records manually. Matches the register columns: student, batch, KLiC hours, installments, and fees."
        actions={
          canWrite ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="ghost" onClick={() => downloadExternalTemplate()}>
                Download template
              </Button>
              <Button type="button" variant="ghost" disabled={importing} onClick={() => fileRef.current?.click()}>
                {importing ? "Importing…" : "Upload Excel"}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setEditRow(null);
                  setEditorOpen(true);
                }}
              >
                Add record
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onImportFile(file);
                }}
              />
            </div>
          ) : null
        }
      />

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <Field label="Search">
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Name, contact, course, address…"
          />
        </Field>
        <Field label="Course">
          <Input
            value={course}
            onChange={(e) => {
              setCourse(e.target.value);
              setPage(1);
            }}
            placeholder="MS-CIT"
          />
        </Field>
        <Field label="Session">
          <Select
            value={sessionLabel}
            onChange={(e) => {
              setSessionLabel(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All sessions</option>
            <option value="ADMISSION-2026">ADMISSION-2026</option>
            <option value="ADMISSION-2025">ADMISSION-2025</option>
          </Select>
        </Field>
      </div>

      {isLoading ? (
        <Skeleton className="h-48" />
      ) : isError ? (
        <EmptyState title="Could not load records" body="Check the API, then retry." action={<Button onClick={() => refetch()}>Retry</Button>} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No external records yet"
          body="Upload your admission Excel sheet or add a student manually."
          action={
            canWrite ? (
              <Button
                type="button"
                onClick={() => {
                  setEditRow(null);
                  setEditorOpen(true);
                }}
              >
                Add first record
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[1400px] text-left text-sm">
            <thead className="border-b border-white/8 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
              <tr>
                <th className="px-3 py-2">Sr</th>
                <th className="px-3 py-2">Student</th>
                <th className="px-3 py-2">Batch</th>
                <th className="px-3 py-2">Address</th>
                <th className="px-3 py-2">Course</th>
                <th className="px-3 py-2">Admission</th>
                <th className="px-3 py-2">Contact</th>
                <th className="px-3 py-2">KLiC 120</th>
                <th className="px-3 py-2">KLiC 60</th>
                <th className="px-3 py-2">KLiC 30</th>
                <th className="px-3 py-2">1st</th>
                <th className="px-3 py-2">2nd</th>
                <th className="px-3 py-2">3rd</th>
                <th className="px-3 py-2">4th</th>
                <th className="px-3 py-2">Paid</th>
                <th className="px-3 py-2">Balance</th>
                <th className="px-3 py-2">Total</th>
                {canWrite ? <th className="px-3 py-2">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={String(row._id)} className="border-b border-white/5 align-top">
                  <td className="px-3 py-2 font-mono text-xs">{row.serialNo ?? "—"}</td>
                  <td className="px-3 py-2 font-medium">{row.studentName}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{row.batchTime || "—"}</td>
                  <td className="px-3 py-2 max-w-[140px] text-xs">{row.address || "—"}</td>
                  <td className="px-3 py-2">{row.course || "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{row.admissionDate || "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.contactNo || "—"}</td>
                  <td className="px-3 py-2 text-xs">{row.klic120 || "—"}</td>
                  <td className="px-3 py-2 text-xs">{row.klic60 || "—"}</td>
                  <td className="px-3 py-2 text-xs">{row.klic30 || "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs">{instCell(row, 0)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs">{instCell(row, 1)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs">{instCell(row, 2)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs">{instCell(row, 3)}</td>
                  <td className="px-3 py-2">{money(row.paidFees)}</td>
                  <td className="px-3 py-2">{money(row.balanceFees)}</td>
                  <td className="px-3 py-2 font-medium">{money(row.totalFees)}</td>
                  {canWrite ? (
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-8 px-2 text-[10px]"
                          onClick={() => {
                            setEditRow(row);
                            setEditorOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          className="h-8 px-2 text-[10px]"
                          onClick={() => setRemoveId(String(row._id))}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {meta ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500">
          <span>
            Page {meta.currentPage ?? page} of {meta.totalPages ?? 1} · {meta.totalItems ?? 0} records
          </span>
          {(meta.totalPages ?? 1) > 1 ? (
            <div className="flex gap-2">
              <Button type="button" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={page >= (meta.totalPages ?? 1)}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <ExternalEditorModal
        open={editorOpen}
        row={editRow}
        onClose={() => {
          setEditorOpen(false);
          setEditRow(null);
        }}
        onSaved={() => refetch()}
      />

      <ConfirmDialog
        open={Boolean(removeId)}
        title="Delete record?"
        body="This removes the external admission row permanently."
        busy={removeState.isLoading}
        onConfirm={async () => {
          if (!removeId) return;
          try {
            await remove({ resource: "external-admissions", id: removeId }).unwrap();
            toast("Record deleted");
            setRemoveId(null);
            refetch();
          } catch {
            toast("Delete failed", "error");
          }
        }}
        onClose={() => setRemoveId(null)}
      />
    </div>
  );
}
