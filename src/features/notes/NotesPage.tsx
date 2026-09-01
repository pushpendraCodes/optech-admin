import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader, EmptyState, Skeleton, StatusBadge } from "@/components/Chrome";
import { Button } from "@/components/Button";
import { Field, Input, Select } from "@/components/Field";
import { ConfirmDialog, Modal } from "@/components/Modal";
import { useCreateMutation, useListQuery, usePatchMutation, useRemoveMutation } from "@/app/api";
import { toast } from "@/components/Toast";
import { useCan } from "@/hooks/useAuth";
import { loc } from "@/utils/format";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { MaterialUploadField, assetUrl, type MaterialAsset } from "./MaterialUploadField";

const schema = z.object({
  title: z.string().min(2, "Title is required"),
  chapter: z.string().min(1, "Chapter is required"),
  course: z.string().min(1, "Select a course"),
  type: z.enum(["pdf", "doc", "video", "link"]),
  externalUrl: z.string().optional(),
  published: z.boolean().optional(),
});

type Form = z.infer<typeof schema>;

function courseId(row: Record<string, unknown>) {
  const cat = row.course;
  if (cat && typeof cat === "object" && "_id" in (cat as object)) return String((cat as { _id: unknown })._id);
  return cat ? String(cat) : "";
}

function courseLabel(row: Record<string, unknown>) {
  const cat = row.course;
  if (cat && typeof cat === "object" && "title" in (cat as object)) return loc((cat as { title: unknown }).title);
  return "—";
}

export function NotesPage() {
  const canWrite = useCan("notes:write");
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [page, setPage] = useState(1);
  const debounced = useDebouncedValue(search);
  const [open, setOpen] = useState(false);
  const [editRow, setEditRow] = useState<Record<string, unknown> | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [asset, setAsset] = useState<MaterialAsset | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const listExtra = useMemo(() => {
    const q: Record<string, string> = {};
    if (courseFilter) q.course = courseFilter;
    return q;
  }, [courseFilter]);

  const { data, isLoading, isError, refetch } = useListQuery({ resource: "notes", page, search: debounced, extra: listExtra });
  const courses = useListQuery({ resource: "courses", page: 1, limit: 100 });
  const [create, createState] = useCreateMutation();
  const [patch, patchState] = usePatchMutation();
  const [remove, removeState] = useRemoveMutation();

  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { type: "pdf", published: true },
  });

  const materialType = form.watch("type");
  const rows = data?.data ?? [];
  const meta = data?.meta;

  function openCreate() {
    setEditRow(null);
    setAsset(null);
    setFormError(null);
    form.reset({ type: "pdf", published: true, title: "", chapter: "", course: "", externalUrl: "" });
    setOpen(true);
  }

  function openEdit(row: Record<string, unknown>) {
    setEditRow(row);
    setFormError(null);
    setAsset((row.asset as MaterialAsset | undefined) ?? null);
    form.reset({
      title: String(row.title ?? ""),
      chapter: String(row.chapter ?? ""),
      course: courseId(row),
      type: (row.type as Form["type"]) ?? "pdf",
      externalUrl: String(row.externalUrl ?? ""),
      published: row.published !== false,
    });
    setOpen(true);
  }

  async function saveNote(values: Form) {
    setFormError(null);
    if (values.type === "link") {
      const url = (values.externalUrl ?? "").trim();
      if (!url) {
        setFormError("Enter the external link URL.");
        return;
      }
    } else if (!asset && !assetUrl(editRow?.asset)) {
      setFormError(`Upload a ${values.type.toUpperCase()} file.`);
      return;
    }

    const body: Record<string, unknown> = {
      title: values.title,
      chapter: values.chapter,
      course: values.course,
      type: values.type,
      published: values.published !== false,
    };

    if (values.type === "link") {
      body.externalUrl = values.externalUrl?.trim();
      body.asset = undefined;
    } else {
      body.asset = asset ?? editRow?.asset;
      body.externalUrl = undefined;
    }

    try {
      if (editRow) {
        await patch({ resource: "notes", id: String(editRow._id), body }).unwrap();
        toast("Note updated");
      } else {
        await create({ resource: "notes", body }).unwrap();
        toast("Note saved");
      }
      setOpen(false);
      setEditRow(null);
      refetch();
    } catch {
      toast("Save failed", "error");
    }
  }

  return (
    <div>
      <PageHeader
        title="Study material"
        description="PDFs, documents, videos, and external links per course."
        actions={canWrite ? <Button type="button" onClick={openCreate}>New note</Button> : null}
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Search">
          <Input placeholder="Title or chapter…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </Field>
        <Field label="Course">
          <Select value={courseFilter} onChange={(e) => { setCourseFilter(e.target.value); setPage(1); }}>
            <option value="">All courses</option>
            {(courses.data?.data ?? []).map((c) => (
              <option key={String(c._id)} value={String(c._id)}>{loc(c.title)}</option>
            ))}
          </Select>
        </Field>
      </div>

      {isLoading ? (
        <Skeleton className="h-40" />
      ) : isError ? (
        <EmptyState title="Could not load notes" body="Retry after the API is up." action={<Button onClick={() => refetch()}>Retry</Button>} />
      ) : rows.length === 0 ? (
        <EmptyState title="No study material" body="Add PDFs, docs, videos, or links for a course." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="border-b border-white/8 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              <tr>
                <th className="px-4 py-3 text-left">Title</th>
                <th className="px-4 py-3 text-left">Course</th>
                <th className="px-4 py-3 text-left">Chapter</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Views</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={String(row._id)} className="border-b border-white/5">
                  <td className="px-4 py-3">{String(row.title)}</td>
                  <td className="px-4 py-3">{courseLabel(row)}</td>
                  <td className="px-4 py-3">{String(row.chapter ?? "—")}</td>
                  <td className="px-4 py-3 capitalize">{String(row.type)}</td>
                  <td className="px-4 py-3">{String(row.views ?? 0)}</td>
                  <td className="px-4 py-3">
                    {canWrite ? (
                      <div className="flex gap-2">
                        <Button type="button" variant="ghost" onClick={() => openEdit(row)}>Edit</Button>
                        <Button type="button" variant="danger" onClick={() => setRemoveId(String(row._id))}>Delete</Button>
                      </div>
                    ) : (
                      <StatusBadge value="view" />
                    )}
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
            Page {meta.currentPage ?? page} of {meta.totalPages ?? 1} · {meta.totalItems ?? rows.length} items
            {courseFilter ? " (filtered by course)" : ""}
          </span>
          {(meta.totalPages ?? 1) > 1 ? (
            <div className="flex gap-2">
              <Button type="button" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button type="button" variant="ghost" disabled={page >= (meta.totalPages ?? 1)} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <Modal open={open} title={editRow ? "Edit note" : "New note"} onClose={() => { setOpen(false); setEditRow(null); }}>
        <form
          className="grid gap-3"
          noValidate
          onSubmit={form.handleSubmit((v) => void saveNote(v), () => setFormError("Fix the highlighted fields."))}
        >
          {formError ? <p className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{formError}</p> : null}

          <Field label="Title" error={form.formState.errors.title?.message}>
            <Input {...form.register("title")} />
          </Field>
          <Field label="Chapter" error={form.formState.errors.chapter?.message}>
            <Input {...form.register("chapter")} />
          </Field>
          <Field label="Course" error={form.formState.errors.course?.message}>
            <Select {...form.register("course")}>
              <option value="">Select course</option>
              {(courses.data?.data ?? []).map((c) => (
                <option key={String(c._id)} value={String(c._id)}>{loc(c.title)}</option>
              ))}
            </Select>
          </Field>
          <Field label="Type" error={form.formState.errors.type?.message}>
            <Select
              {...form.register("type", {
                onChange: () => {
                  setAsset(null);
                  form.setValue("externalUrl", "");
                },
              })}
            >
              <option value="pdf">PDF</option>
              <option value="doc">Document</option>
              <option value="video">Video</option>
              <option value="link">External link</option>
            </Select>
          </Field>

          {materialType === "link" ? (
            <Field label="External URL" error={form.formState.errors.externalUrl?.message}>
              <Input type="url" placeholder="https://…" {...form.register("externalUrl")} />
            </Field>
          ) : (
            <MaterialUploadField
              materialType={materialType}
              value={asset}
              onChange={setAsset}
            />
          )}

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...form.register("published")} className="accent-[#d4a22f]" />
            Published (visible to enrolled students)
          </label>

          <Button type="submit" disabled={createState.isLoading || patchState.isLoading}>
            {createState.isLoading || patchState.isLoading ? "Saving…" : editRow ? "Update" : "Save"}
          </Button>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(removeId)}
        title="Delete note?"
        body="This removes the study material entry."
        busy={removeState.isLoading}
        onConfirm={async () => {
          if (!removeId) return;
          try {
            await remove({ resource: "notes", id: removeId }).unwrap();
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
