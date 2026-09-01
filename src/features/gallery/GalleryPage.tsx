import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader, EmptyState, Skeleton, StatusBadge } from "@/components/Chrome";
import { Button } from "@/components/Button";
import { Field, Input, Select } from "@/components/Field";
import { ConfirmDialog, Modal } from "@/components/Modal";
import { useCreateMutation, useGetByIdQuery, useListQuery, usePatchMutation, useRemoveMutation } from "@/app/api";
import { toast } from "@/components/Toast";
import { useCan } from "@/hooks/useAuth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { MaterialAsset } from "@/features/notes/MaterialUploadField";
import { assetUrl } from "@/features/notes/MaterialUploadField";
import { GalleryImageUpload, isYoutubeUrl } from "./GalleryImageUpload";

const schema = z.object({
  title: z.string().min(2, "Title is required"),
  kind: z.enum(["photo", "video"]),
  category: z.string().optional(),
  youtubeUrl: z.string().optional(),
  published: z.boolean().optional(),
  sortOrder: z.coerce.number().optional(),
});

type Form = z.infer<typeof schema>;

function photosFromRow(row: Record<string, unknown>): MaterialAsset[] {
  const list = Array.isArray(row.photos) ? row.photos : [];
  return list
    .map((p) => (p && typeof p === "object" && "asset" in (p as object) ? (p as { asset: MaterialAsset }).asset : null))
    .filter(Boolean) as MaterialAsset[];
}

export function GalleryPage() {
  const canWrite = useCan("gallery:write");
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [page, setPage] = useState(1);
  const debounced = useDebouncedValue(search);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [cover, setCover] = useState<MaterialAsset | null>(null);
  const [photos, setPhotos] = useState<MaterialAsset[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const extra = useMemo(() => {
    const q: Record<string, string> = {};
    if (kindFilter) q.kind = kindFilter;
    return q;
  }, [kindFilter]);

  const { data, isLoading, isError, refetch } = useListQuery({ resource: "gallery/albums", page, search: debounced, extra });
  const detail = useGetByIdQuery({ resource: "gallery/albums", id: editId ?? "" }, { skip: !editId || !open });
  const [create, createState] = useCreateMutation();
  const [patch, patchState] = usePatchMutation();
  const [remove, removeState] = useRemoveMutation();

  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { kind: "photo", published: true, sortOrder: 0 },
  });

  const kind = form.watch("kind");
  const youtubeUrl = form.watch("youtubeUrl");
  const rows = data?.data ?? [];
  const meta = data?.meta;

  function openCreate() {
    setEditId(null);
    setCover(null);
    setPhotos([]);
    setFormError(null);
    form.reset({ kind: "photo", published: true, sortOrder: 0, title: "", category: "", youtubeUrl: "" });
    setOpen(true);
  }

  function openEdit(row: Record<string, unknown>) {
    setEditId(String(row._id));
    setFormError(null);
    setOpen(true);
  }

  useEffect(() => {
    if (!open || !editId || !detail.data?.data) return;
    const row = detail.data.data;
    form.reset({
      title: String(row.title ?? ""),
      kind: (row.kind as Form["kind"]) ?? "photo",
      category: String(row.category ?? ""),
      youtubeUrl: String(row.youtubeUrl ?? ""),
      published: row.published !== false,
      sortOrder: Number(row.sortOrder ?? 0),
    });
    setCover((row.cover as MaterialAsset | undefined) ?? null);
    setPhotos(photosFromRow(row));
  }, [open, editId, detail.data, form]);

  async function saveItem(values: Form) {
    setFormError(null);
    if (values.kind === "video") {
      const url = (values.youtubeUrl ?? "").trim();
      if (!url) {
        setFormError("Enter a YouTube video link.");
        return;
      }
      if (!isYoutubeUrl(url)) {
        setFormError("Only YouTube links are allowed (youtube.com or youtu.be).");
        return;
      }
    } else {
      if (!cover?.url && !assetUrl(detail.data?.data?.cover)) {
        setFormError("Upload a cover photo for the album.");
        return;
      }
    }

    const body: Record<string, unknown> = {
      title: values.title,
      kind: values.kind,
      published: values.published !== false,
      sortOrder: values.sortOrder ?? 0,
    };

    if (values.kind === "video") {
      body.youtubeUrl = values.youtubeUrl?.trim();
      body.category = values.category?.trim() || "Video";
    } else {
      body.cover = cover ?? detail.data?.data?.cover;
      body.photos = photos.length ? photos : photosFromRow(detail.data?.data ?? {});
    }

    try {
      if (editId) {
        await patch({ resource: "gallery/albums", id: editId, body }).unwrap();
        toast("Gallery item updated");
      } else {
        await create({ resource: "gallery/albums", body }).unwrap();
        toast("Gallery item saved");
      }
      setOpen(false);
      setEditId(null);
      refetch();
    } catch (err) {
      const msg = (err as { data?: { message?: string } })?.data?.message;
      toast(msg ?? "Save failed", "error");
    }
  }

  return (
    <div>
      <PageHeader
        title="Gallery"
        description="Photo albums and YouTube videos shown on the public gallery page."
        actions={canWrite ? <Button type="button" onClick={openCreate}>New item</Button> : null}
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Search">
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Title…" />
        </Field>
        <Field label="Type">
          <Select value={kindFilter} onChange={(e) => { setKindFilter(e.target.value); setPage(1); }}>
            <option value="">All</option>
            <option value="photo">Photo albums</option>
            <option value="video">Videos</option>
          </Select>
        </Field>
      </div>

      {isLoading ? (
        <Skeleton className="h-40" />
      ) : isError ? (
        <EmptyState title="Could not load gallery" body="Retry after the API is up." action={<Button onClick={() => refetch()}>Retry</Button>} />
      ) : rows.length === 0 ? (
        <EmptyState title="No gallery items" body="Add photo albums or YouTube videos." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="border-b border-white/8 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              <tr>
                <th className="px-4 py-3 text-left">Title</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Details</th>
                <th className="px-4 py-3 text-left">Published</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={String(row._id)} className="border-b border-white/5">
                  <td className="px-4 py-3 font-medium">{String(row.title)}</td>
                  <td className="px-4 py-3 capitalize">{String(row.kind ?? "photo")}</td>
                  <td className="px-4 py-3 text-xs text-zinc-400">
                    {row.kind === "video"
                      ? String(row.youtubeUrl ?? "—")
                      : `${row.photoCount ?? 0} photos`}
                  </td>
                  <td className="px-4 py-3"><StatusBadge value={row.published ? "active" : "inactive"} /></td>
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
          <span>Page {meta.currentPage ?? page} of {meta.totalPages ?? 1} · {meta.totalItems ?? 0} items</span>
          {(meta.totalPages ?? 1) > 1 ? (
            <div className="flex gap-2">
              <Button type="button" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button type="button" variant="ghost" disabled={page >= (meta.totalPages ?? 1)} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <Modal open={open} title={editId ? "Edit gallery item" : "New gallery item"} onClose={() => { setOpen(false); setEditId(null); }}>
        <form
          className="grid max-h-[75vh] gap-3 overflow-y-auto pr-1"
          noValidate
          onSubmit={form.handleSubmit((v) => void saveItem(v), () => setFormError("Fix the highlighted fields."))}
        >
          {formError ? <p className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{formError}</p> : null}

          <Field label="Title" error={form.formState.errors.title?.message}>
            <Input {...form.register("title")} />
          </Field>
          <Field label="Type">
            <Select
              {...form.register("kind", {
                onChange: () => {
                  setCover(null);
                  setPhotos([]);
                  form.setValue("youtubeUrl", "");
                  form.setValue("category", "");
                },
              })}
            >
              <option value="photo">Photo album</option>
              <option value="video">YouTube video</option>
            </Select>
          </Field>
          <Field label="Sort order">
            <Input type="number" {...form.register("sortOrder")} />
          </Field>

          {kind === "video" ? (
            <>
              <Field label="Category">
                <Input placeholder="e.g. PGDCA, Workshop" {...form.register("category")} />
              </Field>
              <Field label="YouTube link" error={form.formState.errors.youtubeUrl?.message}>
                <Input type="url" placeholder="https://www.youtube.com/watch?v=…" {...form.register("youtubeUrl")} />
              </Field>
              {youtubeUrl && isYoutubeUrl(youtubeUrl) ? (
                <p className="text-xs text-emerald-400">Valid YouTube link</p>
              ) : youtubeUrl ? (
                <p className="text-xs text-red-300">Use a youtube.com or youtu.be link only</p>
              ) : null}
            </>
          ) : (
            <>
              <GalleryImageUpload label="Cover photo" value={cover} onChange={(v) => setCover(v as MaterialAsset | null)} />
              <GalleryImageUpload label="Album photos" value={photos} onChange={(v) => setPhotos((v as MaterialAsset[]) ?? [])} multiple />
            </>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...form.register("published")} className="accent-[#d4a22f]" />
            Published on website
          </label>

          <Button type="submit" disabled={createState.isLoading || patchState.isLoading}>
            {createState.isLoading || patchState.isLoading ? "Saving…" : editId ? "Update" : "Save"}
          </Button>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(removeId)}
        title="Delete gallery item?"
        body="This removes it from the public gallery."
        busy={removeState.isLoading}
        onConfirm={async () => {
          if (!removeId) return;
          try {
            await remove({ resource: "gallery/albums", id: removeId }).unwrap();
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
