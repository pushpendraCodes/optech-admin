import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader, EmptyState, Skeleton, StatusBadge } from "@/components/Chrome";
import { Button } from "@/components/Button";
import { Field, Input, Textarea } from "@/components/Field";
import { ConfirmDialog, Modal } from "@/components/Modal";
import { PhotoUploadField, StudentAvatar, photoUrl, type PhotoAsset } from "@/components/StudentPhoto";
import { useCreateMutation, useListQuery, usePatchMutation, useRemoveMutation } from "@/app/api";
import { toast } from "@/components/Toast";
import { useCan } from "@/hooks/useAuth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const schema = z.object({
  name: z.string().min(2, "Name is required"),
  batchYear: z.string().min(2, "Batch year is required"),
  role: z.string().optional(),
  story: z.string().optional(),
  featured: z.boolean().optional(),
  published: z.boolean().optional(),
});

type Form = z.infer<typeof schema>;

export function AlumniPage() {
  const canWrite = useCan("cms:write");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debounced = useDebouncedValue(search);
  const [open, setOpen] = useState(false);
  const [editRow, setEditRow] = useState<Record<string, unknown> | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [photo, setPhoto] = useState<PhotoAsset | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useListQuery({
    resource: "alumni",
    page,
    search: debounced,
    limit: 20,
  });
  const [create, createState] = useCreateMutation();
  const [patch, patchState] = usePatchMutation();
  const [remove, removeState] = useRemoveMutation();
  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { featured: false, published: true },
  });
  const rows = data?.data ?? [];
  const meta = data?.meta;

  function openCreate() {
    setEditRow(null);
    setPhoto(null);
    setFormError(null);
    form.reset({ name: "", batchYear: "", role: "", story: "", featured: false, published: true });
    setOpen(true);
  }

  function openEdit(row: Record<string, unknown>) {
    setEditRow(row);
    setPhoto((row.photo as PhotoAsset | undefined) ?? null);
    setFormError(null);
    form.reset({
      name: String(row.name ?? ""),
      batchYear: String(row.batchYear ?? ""),
      role: String(row.role ?? ""),
      story: String(row.story ?? ""),
      featured: Boolean(row.featured),
      published: row.published !== false,
    });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    if (!editRow) setPhoto(null);
  }, [open, editRow]);

  async function save(values: Form) {
    setFormError(null);
    if (!photo?.url && !photoUrl(editRow?.photo)) {
      setFormError("Upload an alumni photo.");
      return;
    }
    const body = {
      ...values,
      photo: photo ?? editRow?.photo,
      featured: Boolean(values.featured),
      published: values.published !== false,
    };
    try {
      if (editRow) {
        await patch({ resource: "alumni", id: String(editRow._id), body }).unwrap();
        toast("Alumni updated");
      } else {
        await create({ resource: "alumni", body }).unwrap();
        toast("Alumni saved");
      }
      setOpen(false);
      setEditRow(null);
      refetch();
    } catch (err) {
      toast((err as { data?: { message?: string } })?.data?.message ?? "Save failed", "error");
    }
  }

  return (
    <div>
      <PageHeader
        title="Alumni"
        description="Graduate stories on the public alumni page — photo, batch, role, and story."
        actions={canWrite ? <Button type="button" onClick={openCreate}>New alumni</Button> : null}
      />

      <div className="mb-4">
        <Field label="Search">
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Name, role, batch…"
          />
        </Field>
      </div>

      {isLoading ? (
        <Skeleton className="h-40" />
      ) : isError ? (
        <EmptyState title="Could not load alumni" body="Retry after the API is up." action={<Button onClick={() => refetch()}>Retry</Button>} />
      ) : rows.length === 0 ? (
        <EmptyState title="No alumni yet" body="Add a graduate with a photo and story." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="border-b border-white/8 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              <tr>
                <th className="px-4 py-3 text-left">Photo</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Batch</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Featured</th>
                <th className="px-4 py-3 text-left">Published</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={String(row._id)} className="border-b border-white/5">
                  <td className="px-4 py-3">
                    <StudentAvatar photo={row.photo} name={String(row.name ?? "")} size="sm" />
                  </td>
                  <td className="px-4 py-3 font-medium">{String(row.name)}</td>
                  <td className="px-4 py-3 text-zinc-400">{String(row.batchYear ?? "—")}</td>
                  <td className="px-4 py-3 text-zinc-400">{String(row.role ?? "—")}</td>
                  <td className="px-4 py-3"><StatusBadge value={row.featured ? "featured" : "directory"} /></td>
                  <td className="px-4 py-3"><StatusBadge value={row.published !== false ? "active" : "inactive"} /></td>
                  <td className="px-4 py-3">
                    {canWrite ? (
                      <div className="flex gap-2">
                        <Button type="button" variant="ghost" onClick={() => openEdit(row)}>Edit</Button>
                        <Button type="button" variant="danger" onClick={() => setRemoveId(String(row._id))}>Delete</Button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {meta ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500">
          <span>
            Page {meta.currentPage ?? page} of {meta.totalPages ?? 1} · {meta.totalItems ?? 0} items
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

      <Modal open={open} title={editRow ? "Edit alumni" : "New alumni"} onClose={() => { setOpen(false); setEditRow(null); }}>
        <form
          className="grid max-h-[75vh] gap-3 overflow-y-auto pr-1"
          noValidate
          onSubmit={form.handleSubmit((v) => void save(v), () => setFormError("Fix the highlighted fields."))}
        >
          {formError ? <p className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{formError}</p> : null}

          <PhotoUploadField
            label="Picture"
            value={photo}
            onChange={setPhoto}
            folder="optech/alumni"
            hint="JPG or PNG. Shown on the public alumni page."
          />

          <Field label="Name" error={form.formState.errors.name?.message}>
            <Input {...form.register("name")} />
          </Field>
          <Field label="Batch year" error={form.formState.errors.batchYear?.message}>
            <Input placeholder="e.g. 2024" {...form.register("batchYear")} />
          </Field>
          <Field label="Role">
            <Input placeholder="e.g. Associate — TCS" {...form.register("role")} />
          </Field>
          <Field label="Story">
            <Textarea rows={4} {...form.register("story")} />
          </Field>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...form.register("featured")} className="accent-[#d4a22f]" />
            Featured story
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...form.register("published")} className="accent-[#d4a22f]" />
            Published on website
          </label>

          <Button type="submit" disabled={createState.isLoading || patchState.isLoading}>
            {createState.isLoading || patchState.isLoading ? "Saving…" : editRow ? "Update" : "Save"}
          </Button>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(removeId)}
        title="Delete alumni profile?"
        body="This removes them from the public alumni page."
        busy={removeState.isLoading}
        onConfirm={async () => {
          if (!removeId) return;
          try {
            await remove({ resource: "alumni", id: removeId }).unwrap();
            toast("Deleted");
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
