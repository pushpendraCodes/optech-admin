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

const optionalUrl = z
  .string()
  .trim()
  .optional()
  .refine((v) => !v || /^https?:\/\//i.test(v), "Use a full URL starting with https://");

const schema = z.object({
  name: z.string().min(2, "Name is required"),
  role: z.string().min(1, "Role is required"),
  focus: z.string().optional(),
  bio: z.string().optional(),
  linkedin: optionalUrl,
  twitter: optionalUrl,
  website: optionalUrl,
  published: z.boolean().optional(),
  sortOrder: z.coerce.number().optional(),
});

type Form = z.infer<typeof schema>;

export function StaffPage() {
  const canWrite = useCan("staff:write");
  const [open, setOpen] = useState(false);
  const [editRow, setEditRow] = useState<Record<string, unknown> | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [photo, setPhoto] = useState<PhotoAsset | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useListQuery({ resource: "staff", page: 1, limit: 100 });
  const [create, createState] = useCreateMutation();
  const [patch, patchState] = usePatchMutation();
  const [remove, removeState] = useRemoveMutation();
  const form = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { published: true, sortOrder: 0 } });
  const rows = data?.data ?? [];

  function openCreate() {
    setEditRow(null);
    setPhoto(null);
    setFormError(null);
    form.reset({ name: "", role: "", focus: "", bio: "", linkedin: "", twitter: "", website: "", published: true, sortOrder: 0 });
    setOpen(true);
  }

  function openEdit(row: Record<string, unknown>) {
    setEditRow(row);
    setPhoto((row.photo as PhotoAsset | undefined) ?? null);
    setFormError(null);
    form.reset({
      name: String(row.name ?? ""),
      role: String(row.role ?? ""),
      focus: String(row.focus ?? ""),
      bio: String(row.bio ?? ""),
      linkedin: String(row.linkedin ?? "").replace(/^#$/, ""),
      twitter: String(row.twitter ?? "").replace(/^#$/, ""),
      website: String(row.website ?? "").replace(/^#$/, ""),
      published: row.published !== false,
      sortOrder: Number(row.sortOrder ?? 0),
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
      setFormError("Upload a staff photo.");
      return;
    }
    const body = {
      ...values,
      linkedin: values.linkedin?.trim() || undefined,
      twitter: values.twitter?.trim() || undefined,
      website: values.website?.trim() || undefined,
      photo: photo ?? editRow?.photo,
      published: values.published !== false,
      sortOrder: values.sortOrder ?? 0,
    };
    try {
      if (editRow) {
        await patch({ resource: "staff", id: String(editRow._id), body }).unwrap();
        toast("Staff profile updated");
      } else {
        await create({ resource: "staff", body }).unwrap();
        toast("Staff profile saved");
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
        title="Staff"
        description="Faculty profiles on the public staff page — photo plus LinkedIn, X, and website."
        actions={canWrite ? <Button type="button" onClick={openCreate}>New staff</Button> : null}
      />

      {isLoading ? (
        <Skeleton className="h-40" />
      ) : isError ? (
        <EmptyState title="Could not load staff" body="Retry after the API is up." action={<Button onClick={() => refetch()}>Retry</Button>} />
      ) : rows.length === 0 ? (
        <EmptyState title="No staff yet" body="Add faculty with a photo and social links." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="border-b border-white/8 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              <tr>
                <th className="px-4 py-3 text-left">Photo</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Social</th>
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
                  <td className="px-4 py-3 text-zinc-400">{String(row.role ?? "—")}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {[row.linkedin && "LinkedIn", row.twitter && "X", row.website && "Web"].filter(Boolean).join(" · ") || "—"}
                  </td>
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

      <Modal open={open} title={editRow ? "Edit staff" : "New staff"} onClose={() => { setOpen(false); setEditRow(null); }}>
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
            folder="optech/staff"
            hint="JPG or PNG. Shown on the public staff page."
          />

          <Field label="Name" error={form.formState.errors.name?.message}>
            <Input {...form.register("name")} />
          </Field>
          <Field label="Role" error={form.formState.errors.role?.message}>
            <Input placeholder="e.g. Head of Programming" {...form.register("role")} />
          </Field>
          <Field label="Focus">
            <Input placeholder="e.g. C · Java · Python" {...form.register("focus")} />
          </Field>
          <Field label="Bio">
            <Textarea rows={4} {...form.register("bio")} />
          </Field>

          <Field label="LinkedIn" error={form.formState.errors.linkedin?.message}>
            <Input type="url" placeholder="https://www.linkedin.com/in/…" {...form.register("linkedin")} />
          </Field>
          <Field label="X (Twitter)" error={form.formState.errors.twitter?.message}>
            <Input type="url" placeholder="https://x.com/…" {...form.register("twitter")} />
          </Field>
          <Field label="Website" error={form.formState.errors.website?.message}>
            <Input type="url" placeholder="https://…" {...form.register("website")} />
          </Field>

          <Field label="Sort order">
            <Input type="number" {...form.register("sortOrder")} />
          </Field>
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
        title="Delete staff profile?"
        body="This removes them from the public staff page."
        busy={removeState.isLoading}
        onConfirm={async () => {
          if (!removeId) return;
          try {
            await remove({ resource: "staff", id: removeId }).unwrap();
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
