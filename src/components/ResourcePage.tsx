import { useState } from "react";
import { toast } from "@/components/Toast";
import { Button } from "@/components/Button";
import { EmptyState, PageHeader, Skeleton, StatusBadge } from "@/components/Chrome";
import { ConfirmDialog, Modal } from "@/components/Modal";
import { Field, Input, Select, Textarea } from "@/components/Field";
import { useCan } from "@/hooks/useAuth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useCreateMutation, useListQuery, usePatchMutation, useRemoveMutation } from "@/app/api";

export type Column = { key: string; label: string; render?: (row: Record<string, unknown>) => React.ReactNode };
export type FormField = { name: string; label: string; type?: string; options?: string[] };

function cell(row: Record<string, unknown>, key: string) {
  const value = key.split(".").reduce<unknown>((acc, part) => (acc as Record<string, unknown>)?.[part], row);
  if (value && typeof value === "object" && "en" in (value as object)) return String((value as { en: string }).en);
  if (typeof value === "boolean") return value ? "yes" : "no";
  return value == null ? "—" : String(value);
}

export function ResourcePage({
  title,
  description,
  resource,
  permission,
  columns,
  fields,
  extraQuery,
  createPath,
  allowDelete = false,
  localize = [],
}: {
  title: string;
  description: string;
  resource: string;
  permission: string;
  columns: Column[];
  fields: FormField[];
  extraQuery?: Record<string, string>;
  createPath?: string;
  allowDelete?: boolean;
  localize?: string[];
}) {
  const canWrite = useCan(permission);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [open, setOpen] = useState(false);
  const [editRow, setEditRow] = useState<Record<string, unknown> | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const { data, isLoading, isError, refetch } = useListQuery({
    resource,
    page,
    search: debouncedSearch,
    extra: extraQuery,
  });
  const [create, createState] = useCreateMutation();
  const [patch, patchState] = usePatchMutation();
  const [remove, removeState] = useRemoveMutation();

  function fieldValue(row: Record<string, unknown> | null, name: string) {
    if (!row) return "";
    const value = row[name];
    if (value && typeof value === "object" && "en" in (value as object)) return String((value as { en: string }).en);
    if (typeof value === "boolean") return value ? "on" : "";
    return value == null ? "" : String(value);
  }

  const rows = data?.data ?? [];
  const meta = data?.meta;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {};
    fields.forEach((f) => {
      const raw = String(form.get(f.name) ?? "");
      if (localize.includes(f.name)) body[f.name] = { en: raw };
      else if (f.type === "number") body[f.name] = Number(raw);
      else if (f.type === "checkbox") body[f.name] = form.get(f.name) === "on";
      else if (f.type === "json") {
        try {
          body[f.name] = JSON.parse(raw || "null");
        } catch {
          body[f.name] = raw;
        }
      } else body[f.name] = raw;
    });
    try {
      if (editRow) {
        await patch({ resource: createPath ?? resource, id: String(editRow._id ?? editRow.id), body }).unwrap();
      } else {
        await create({ resource: createPath ?? resource, body }).unwrap();
      }
      toast("Saved");
      setOpen(false);
      setEditRow(null);
    } catch (err) {
      toast((err as { data?: { message?: string } })?.data?.message ?? "Save failed", "error");
    }
  }

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        actions={
          canWrite && fields.length > 0 ? (
            <Button type="button" onClick={() => setOpen(true)}>
              New
            </Button>
          ) : null
        }
      />
      <div className="mb-4">
        <Input
          placeholder="Search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton />
          <Skeleton />
          <Skeleton />
        </div>
      ) : isError ? (
        <EmptyState title="Could not load" body="Check that the API is running, then retry." />
      ) : rows.length === 0 ? (
        <EmptyState title="Nothing here yet" body="Create the first record to get started." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-white/8 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className="px-4 py-3 font-medium">
                    {c.label}
                  </th>
                ))}
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const id = String(row._id ?? row.id ?? "");
                return (
                  <tr key={id} className="border-b border-white/5 last:border-0">
                    {columns.map((c) => (
                      <td key={c.key} className="px-4 py-3">
                        {c.render ? c.render(row) : <span className="text-zinc-200">{cell(row, c.key)}</span>}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <div className="flex gap-3">
                        {canWrite && fields.length > 0 ? (
                          <button
                            type="button"
                            className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent"
                            onClick={() => {
                              setEditRow(row);
                              setOpen(true);
                            }}
                          >
                            Edit
                          </button>
                        ) : null}
                        {canWrite && allowDelete ? (
                          <button
                            type="button"
                            className="font-mono text-[10px] uppercase tracking-[0.16em] text-danger"
                            onClick={() => setRemoveId(id)}
                          >
                            Delete
                          </button>
                        ) : fields.length === 0 ? (
                          <StatusBadge value="view" />
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
      {isError ? (
        <Button className="mt-3" variant="ghost" onClick={() => refetch()}>
          Retry
        </Button>
      ) : null}

      <Modal
        open={open}
        title={`${editRow ? "Edit" : "New"} ${title}`}
        onClose={() => {
          setOpen(false);
          setEditRow(null);
        }}
      >
        <form key={editRow ? String(editRow._id ?? "edit") : "new"} className="grid gap-3" onSubmit={onSubmit}>
          {fields.map((f) => (
            <Field key={f.name} label={f.label}>
              {f.options ? (
                <Select name={f.name} defaultValue={fieldValue(editRow, f.name) || f.options[0]}>
                  {f.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </Select>
              ) : f.type === "textarea" || f.type === "json" ? (
                <Textarea
                  name={f.name}
                  required={f.type !== "json"}
                  placeholder={f.type === "json" ? "{}" : undefined}
                  defaultValue={fieldValue(editRow, f.name)}
                />
              ) : (
                <Input
                  name={f.name}
                  type={f.type ?? "text"}
                  required={f.type !== "checkbox"}
                  defaultValue={fieldValue(editRow, f.name)}
                />
              )}
            </Field>
          ))}
          <Button type="submit" disabled={createState.isLoading || patchState.isLoading}>
            {createState.isLoading || patchState.isLoading ? "Saving…" : "Save"}
          </Button>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(removeId)}
        title="Delete record?"
        body="This cannot be undone from the admin UI."
        busy={removeState.isLoading}
        onClose={() => setRemoveId(null)}
        onConfirm={async () => {
          if (!removeId) return;
          try {
            await remove({ resource, id: removeId }).unwrap();
            toast("Deleted");
            setRemoveId(null);
          } catch {
            toast("Delete failed — endpoint may not allow delete", "error");
          }
        }}
      />
    </div>
  );
}
