import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader, EmptyState, Skeleton, StatusBadge } from "@/components/Chrome";
import { Button } from "@/components/Button";
import { Field, Input, Textarea } from "@/components/Field";
import { ConfirmDialog, Modal } from "@/components/Modal";
import { PhotoUploadField, photoUrl, type PhotoAsset } from "@/components/StudentPhoto";
import { useCreateMutation, useListQuery, usePatchMutation, useRemoveMutation } from "@/app/api";
import { toast } from "@/components/Toast";
import { useCan } from "@/hooks/useAuth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const schema = z.object({
  title: z.string().min(2, "Title is required"),
  body: z.string().optional(),
  href: z.string().optional(),
  cta: z.string().optional(),
  active: z.boolean().optional(),
  sortOrder: z.coerce.number().optional(),
});

type Form = z.infer<typeof schema>;

export function PopupsPage() {
  const canWrite = useCan("cms:write");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debounced = useDebouncedValue(search);
  const [open, setOpen] = useState(false);
  const [editRow, setEditRow] = useState<Record<string, unknown> | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [image, setImage] = useState<PhotoAsset | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useListQuery({
    resource: "cms",
    page,
    search: debounced,
    limit: 20,
    extra: { kind: "popup" },
  });
  const [create, createState] = useCreateMutation();
  const [patch, patchState] = usePatchMutation();
  const [remove, removeState] = useRemoveMutation();
  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { active: true, sortOrder: 0, cta: "Learn more" },
  });
  const rows = data?.data ?? [];
  const meta = data?.meta;
  const activeCount = rows.filter((r) => r.active !== false).length;

  function openCreate() {
    setEditRow(null);
    setImage(null);
    setFormError(null);
    form.reset({ title: "", body: "", href: "", cta: "Learn more", active: true, sortOrder: 0 });
    setOpen(true);
  }

  function openEdit(row: Record<string, unknown>) {
    setEditRow(row);
    setImage((row.image as PhotoAsset | undefined) ?? null);
    setFormError(null);
    form.reset({
      title: String(row.title ?? ""),
      body: String(row.body ?? ""),
      href: String(row.href ?? ""),
      cta: String(row.cta ?? "Learn more"),
      active: row.active !== false,
      sortOrder: Number(row.sortOrder ?? 0),
    });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    if (!editRow) setImage(null);
  }, [open, editRow]);

  async function save(values: Form) {
    setFormError(null);
    if (!image?.url && !photoUrl(editRow?.image)) {
      setFormError("Upload a popup media image.");
      return;
    }
    const body = {
      kind: "popup",
      slot: "main",
      title: values.title,
      body: values.body?.trim() || undefined,
      href: values.href?.trim() || undefined,
      cta: values.cta?.trim() || "Learn more",
      image: image ?? editRow?.image,
      active: values.active !== false,
      sortOrder: values.sortOrder ?? 0,
    };
    try {
      if (editRow) {
        await patch({ resource: "cms", id: String(editRow._id), body }).unwrap();
        toast(body.active ? "Popup saved — now the only active main popup" : "Popup updated");
      } else {
        await create({ resource: "cms", body }).unwrap();
        toast(body.active ? "Popup saved — now the only active main popup" : "Popup saved");
      }
      setOpen(false);
      setEditRow(null);
      refetch();
    } catch (err) {
      toast((err as { data?: { message?: string } })?.data?.message ?? "Save failed", "error");
    }
  }

  async function setActiveOnly(id: string) {
    try {
      await patch({ resource: "cms", id, body: { kind: "popup", active: true } }).unwrap();
      toast("This popup is now the only active one");
      refetch();
    } catch {
      toast("Could not activate popup", "error");
    }
  }

  return (
    <div>
      <PageHeader
        title="Popups"
        description="Main homepage popup. Only one can be active at a time — activating one turns the others off."
        actions={canWrite ? <Button type="button" onClick={openCreate}>New popup</Button> : null}
      />

      {activeCount > 1 ? (
        <p className="mb-4 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Multiple popups look active in this page. Edit or activate one — the API keeps a single active popup for the website.
        </p>
      ) : null}

      <div className="mb-4">
        <Field label="Search">
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Title…"
          />
        </Field>
      </div>

      {isLoading ? (
        <Skeleton className="h-40" />
      ) : isError ? (
        <EmptyState title="Could not load popups" body="Retry after the API is up." action={<Button onClick={() => refetch()}>Retry</Button>} />
      ) : rows.length === 0 ? (
        <EmptyState title="No popups" body="Create a main popup with media." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-b border-white/8 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              <tr>
                <th className="px-4 py-3 text-left">Media</th>
                <th className="px-4 py-3 text-left">Title</th>
                <th className="px-4 py-3 text-left">Link</th>
                <th className="px-4 py-3 text-left">Active</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const url = photoUrl(row.image);
                const isActive = row.active !== false;
                return (
                  <tr key={String(row._id)} className="border-b border-white/5">
                    <td className="px-4 py-3">
                      {url ? (
                        <img src={url} alt="" className="h-12 w-20 rounded border border-white/10 object-cover" />
                      ) : (
                        <span className="text-xs text-zinc-500">No image</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">{String(row.title)}</td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-xs text-zinc-500">{String(row.href ?? "—")}</td>
                    <td className="px-4 py-3"><StatusBadge value={isActive ? "active" : "inactive"} /></td>
                    <td className="px-4 py-3">
                      {canWrite ? (
                        <div className="flex flex-wrap gap-2">
                          {!isActive ? (
                            <Button type="button" variant="ghost" onClick={() => void setActiveOnly(String(row._id))}>
                              Make active
                            </Button>
                          ) : null}
                          <Button type="button" variant="ghost" onClick={() => openEdit(row)}>Edit</Button>
                          <Button type="button" variant="danger" onClick={() => setRemoveId(String(row._id))}>Delete</Button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
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
              <Button type="button" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button type="button" variant="ghost" disabled={page >= (meta.totalPages ?? 1)} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <Modal open={open} title={editRow ? "Edit popup" : "New popup"} onClose={() => { setOpen(false); setEditRow(null); }}>
        <form
          className="grid max-h-[75vh] gap-3 overflow-y-auto pr-1"
          noValidate
          onSubmit={form.handleSubmit((v) => void save(v), () => setFormError("Fix the highlighted fields."))}
        >
          {formError ? <p className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{formError}</p> : null}

          <PhotoUploadField
            label="Popup media"
            value={image}
            onChange={setImage}
            folder="optech/popups"
            sizeGuide="960 × 720 px (landscape 4:3)"
            previewAspect="4 / 3"
            hint="Main popup left panel is about 560×420 on desktop. Upload 960×720 so the full image fits without cropping. Keep text/logos away from the bottom edge (title overlay)."
            buttonLabel="popup media"
          />

          <Field label="Title" error={form.formState.errors.title?.message}>
            <Input {...form.register("title")} />
          </Field>
          <Field label="Body">
            <Textarea rows={4} {...form.register("body")} />
          </Field>
          <Field label="Link URL">
            <Input placeholder="/scholarship or https://…" {...form.register("href")} />
          </Field>
          <Field label="CTA label">
            <Input placeholder="Learn more" {...form.register("cta")} />
          </Field>
          <Field label="Sort order">
            <Input type="number" {...form.register("sortOrder")} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...form.register("active")} className="accent-[#d4a22f]" />
            Active (turns off all other main popups)
          </label>

          <Button type="submit" disabled={createState.isLoading || patchState.isLoading}>
            {createState.isLoading || patchState.isLoading ? "Saving…" : editRow ? "Update" : "Save"}
          </Button>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(removeId)}
        title="Delete popup?"
        body="This removes it from the homepage."
        busy={removeState.isLoading}
        onConfirm={async () => {
          if (!removeId) return;
          try {
            await remove({ resource: "cms", id: removeId }).unwrap();
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
