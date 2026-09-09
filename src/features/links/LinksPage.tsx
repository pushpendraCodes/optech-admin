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
  href: z
    .string()
    .trim()
    .min(1, "URL is required")
    .refine((v) => /^https?:\/\//i.test(v), "Use a full URL starting with https://"),
  cta: z.string().optional(),
  slot: z.string().optional(),
  featured: z.boolean().optional(),
  active: z.boolean().optional(),
  sortOrder: z.coerce.number().optional(),
});

type Form = z.infer<typeof schema>;

export function LinksPage() {
  const canWrite = useCan("cms:write");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debounced = useDebouncedValue(search);
  const [open, setOpen] = useState(false);
  const [editRow, setEditRow] = useState<Record<string, unknown> | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [logo, setLogo] = useState<PhotoAsset | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useListQuery({
    resource: "cms",
    page,
    search: debounced,
    limit: 20,
    extra: { kind: "link" },
  });
  const [create, createState] = useCreateMutation();
  const [patch, patchState] = usePatchMutation();
  const [remove, removeState] = useRemoveMutation();
  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { active: true, sortOrder: 0, cta: "Visit site", featured: false, slot: "" },
  });
  const rows = data?.data ?? [];
  const meta = data?.meta;

  function openCreate() {
    setEditRow(null);
    setLogo(null);
    setFormError(null);
    form.reset({ title: "", body: "", href: "", cta: "Visit site", slot: "", featured: false, active: true, sortOrder: 0 });
    setOpen(true);
  }

  function openEdit(row: Record<string, unknown>) {
    setEditRow(row);
    setLogo((row.image as PhotoAsset | undefined) ?? null);
    setFormError(null);
    form.reset({
      title: String(row.title ?? ""),
      body: String(row.body ?? ""),
      href: String(row.href ?? ""),
      cta: String(row.cta ?? "Visit site"),
      slot: String(row.slot ?? ""),
      featured: Boolean(row.featured),
      active: row.active !== false,
      sortOrder: Number(row.sortOrder ?? 0),
    });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    if (!editRow) setLogo(null);
  }, [open, editRow]);

  async function save(values: Form) {
    setFormError(null);
    const body = {
      kind: "link",
      title: values.title.trim(),
      body: values.body?.trim() || undefined,
      href: values.href.trim(),
      cta: values.cta?.trim() || "Visit site",
      slot: values.slot?.trim() || undefined,
      featured: Boolean(values.featured),
      image: logo?.url ? logo : null,
      active: values.active !== false,
      sortOrder: values.sortOrder ?? 0,
    };
    try {
      if (editRow) {
        await patch({ resource: "cms", id: String(editRow._id), body }).unwrap();
        toast("Useful link updated");
      } else {
        await create({ resource: "cms", body }).unwrap();
        toast("Useful link saved");
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
        title="Useful links"
        description="Public resource links shown on the website Useful links page. Add a logo for each portal."
        actions={canWrite ? <Button type="button" onClick={openCreate}>New link</Button> : null}
      />

      <div className="mb-4">
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search links…"
        />
      </div>

      {isLoading ? (
        <Skeleton className="h-40" />
      ) : isError ? (
        <EmptyState title="Could not load links" body="Try again in a moment." />
      ) : rows.length === 0 ? (
        <EmptyState title="No useful links yet" body="Add exam portals, result sites, and other public resources with a logo." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-white/10 bg-white/5 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400">
              <tr>
                <th className="px-4 py-3">Logo</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">URL</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const url = photoUrl(row.image);
                return (
                  <tr key={String(row._id)} className="border-b border-white/6">
                    <td className="px-4 py-3">
                      {url ? (
                        <img src={url} alt="" className="h-10 w-10 rounded-lg border border-white/10 object-contain bg-white/5" />
                      ) : (
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-[10px] text-zinc-500">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-white">
                      {String(row.title ?? "")}
                      {row.featured ? (
                        <span className="ml-2 font-mono text-[9px] uppercase tracking-[0.16em] text-violet-300">Featured</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                      {String(row.slot ?? "—")}
                    </td>
                    <td className="max-w-[240px] truncate px-4 py-3 text-zinc-400">{String(row.href ?? "")}</td>
                    <td className="px-4 py-3">
                      <StatusBadge value={row.active !== false ? "active" : "inactive"} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canWrite ? (
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="ghost" onClick={() => openEdit(row)}>
                            Edit
                          </Button>
                          <Button type="button" variant="danger" onClick={() => setRemoveId(String(row._id))}>
                            Delete
                          </Button>
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

      {meta && Number(meta.totalPages ?? 1) > 1 ? (
        <div className="mt-4 flex gap-2">
          <Button type="button" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Prev
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={page >= Number(meta.totalPages)}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}

      <Modal
        open={open}
        title={editRow ? "Edit useful link" : "New useful link"}
        onClose={() => {
          setOpen(false);
          setEditRow(null);
        }}
      >
        <form
          className="grid max-h-[75vh] gap-3 overflow-y-auto pr-1"
          noValidate
          onSubmit={form.handleSubmit((v) => void save(v), () => setFormError("Fix the highlighted fields."))}
        >
          {formError ? (
            <p className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{formError}</p>
          ) : null}

          <PhotoUploadField
            label="Logo"
            value={logo}
            onChange={setLogo}
            folder="optech/links"
            hint="Square PNG or JPG. Shown on the public Useful links page."
            sizeGuide="256 × 256 px"
            previewAspect="1 / 1"
            buttonLabel="logo"
          />

          <Field label="Title" error={form.formState.errors.title?.message}>
            <Input placeholder="e.g. SSC / Govt exam portal" {...form.register("title")} />
          </Field>
          <Field label="Description">
            <Textarea rows={3} placeholder="Short note about this resource" {...form.register("body")} />
          </Field>
          <Field label="URL" error={form.formState.errors.href?.message}>
            <Input type="url" placeholder="https://…" {...form.register("href")} />
          </Field>
          <Field label="Category">
            <Input placeholder="e.g. Exam, Result, Govt" {...form.register("slot")} />
          </Field>
          <Field label="Button label">
            <Input placeholder="Visit site" {...form.register("cta")} />
          </Field>
          <Field label="Sort order">
            <Input type="number" {...form.register("sortOrder")} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...form.register("featured")} className="accent-accent" />
            Featured badge
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...form.register("active")} className="accent-accent" />
            Published on website
          </label>

          <Button type="submit" disabled={createState.isLoading || patchState.isLoading}>
            {createState.isLoading || patchState.isLoading ? "Saving…" : editRow ? "Update" : "Save"}
          </Button>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(removeId)}
        title="Delete this link?"
        body="It will disappear from the public Useful links page."
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
