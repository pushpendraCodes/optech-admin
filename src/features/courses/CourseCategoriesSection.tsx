import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/Button";
import { Field, Input } from "@/components/Field";
import { ConfirmDialog, Modal } from "@/components/Modal";
import { EmptyState, Skeleton, StatusBadge } from "@/components/Chrome";
import { useCreateMutation, useListQuery, usePatchMutation, useRemoveMutation } from "@/app/api";
import { toast } from "@/components/Toast";
import { useCan } from "@/hooks/useAuth";
import { loc } from "@/utils/format";

const schema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2),
  sortOrder: z.coerce.number().min(0).optional(),
  active: z.boolean().optional(),
});

type Form = z.infer<typeof schema>;

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function CourseCategoriesSection() {
  const canCreate = useCan("course:create");
  const canUpdate = useCan("course:update");
  const { data, isLoading, isError, refetch } = useListQuery({ resource: "categories", page: 1 });
  const [create, createState] = useCreateMutation();
  const [patch, patchState] = usePatchMutation();
  const [remove, removeState] = useRemoveMutation();
  const [open, setOpen] = useState(false);
  const [editRow, setEditRow] = useState<Record<string, unknown> | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const rows = data?.data ?? [];

  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { sortOrder: 0, active: true },
  });

  function openCreate() {
    setEditRow(null);
    form.reset({ name: "", slug: "", sortOrder: 0, active: true });
    setOpen(true);
  }

  function openEdit(row: Record<string, unknown>) {
    setEditRow(row);
    form.reset({
      name: loc(row.name),
      slug: String(row.slug ?? ""),
      sortOrder: Number(row.sortOrder ?? 0),
      active: row.active !== false,
    });
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    setEditRow(null);
  }

  return (
    <section className="mb-8">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-sans text-base font-semibold text-zinc-100">Course categories</h2>
          <p className="mt-1 text-sm text-zinc-500">Group programmes for filters and the public course catalogue.</p>
        </div>
        {canCreate ? (
          <Button type="button" onClick={openCreate}>
            New category
          </Button>
        ) : null}
      </div>
      {isLoading ? (
        <Skeleton className="h-32" />
      ) : isError ? (
        <EmptyState title="Could not load categories" body="Check the API connection." action={<Button onClick={() => refetch()}>Retry</Button>} />
      ) : rows.length === 0 ? (
        <EmptyState title="No categories" body="Add a category before creating courses." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="border-b border-white/8 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Slug</th>
                <th className="px-4 py-3 text-left">Order</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={String(row._id)} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-3">{loc(row.name)}</td>
                  <td className="px-4 py-3 font-mono text-xs">{String(row.slug)}</td>
                  <td className="px-4 py-3">{String(row.sortOrder ?? 0)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge value={row.active !== false ? "published" : "draft"} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {canUpdate ? (
                        <button
                          type="button"
                          className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent"
                          onClick={() => openEdit(row)}
                        >
                          Edit
                        </button>
                      ) : null}
                      {canUpdate ? (
                        <button
                          type="button"
                          className="font-mono text-[10px] uppercase tracking-[0.16em] text-danger"
                          onClick={() => setRemoveId(String(row._id))}
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} title={editRow ? "Edit category" : "New category"} onClose={closeModal}>
        <form
          className="grid gap-3"
          onSubmit={form.handleSubmit(async (values) => {
            const body = {
              name: { en: values.name },
              slug: values.slug,
              sortOrder: values.sortOrder ?? 0,
              active: values.active ?? true,
            };
            try {
              if (editRow) {
                await patch({ resource: "categories", id: String(editRow._id), body }).unwrap();
              } else {
                await create({ resource: "categories", body }).unwrap();
              }
              toast("Category saved");
              closeModal();
            } catch (err) {
              toast((err as { data?: { message?: string } })?.data?.message ?? "Save failed", "error");
            }
          })}
        >
          <Field label="Name" error={form.formState.errors.name?.message}>
            <Input
              {...form.register("name", {
                onChange: (e) => {
                  if (!editRow && !form.getValues("slug")) {
                    form.setValue("slug", slugify(e.target.value));
                  }
                },
              })}
            />
          </Field>
          <Field label="Slug" error={form.formState.errors.slug?.message}>
            <Input {...form.register("slug")} />
          </Field>
          <Field label="Sort order">
            <Input type="number" {...form.register("sortOrder")} />
          </Field>
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input type="checkbox" {...form.register("active")} className="rounded border-white/20" />
            Active on website
          </label>
          <Button type="submit" disabled={createState.isLoading || patchState.isLoading}>
            {createState.isLoading || patchState.isLoading ? "Saving…" : "Save"}
          </Button>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(removeId)}
        title="Delete category?"
        body="Courses linked to this category may break. Delete only if unused."
        busy={removeState.isLoading}
        onClose={() => setRemoveId(null)}
        onConfirm={async () => {
          if (!removeId) return;
          try {
            await remove({ resource: "categories", id: removeId }).unwrap();
            toast("Deleted");
            setRemoveId(null);
          } catch {
            toast("Delete failed — category may still be in use", "error");
          }
        }}
      />
    </section>
  );
}
