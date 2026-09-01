import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader, EmptyState, Skeleton, StatusBadge } from "@/components/Chrome";
import { Button } from "@/components/Button";
import { Field, Input, Select, Textarea } from "@/components/Field";
import { ConfirmDialog, Modal } from "@/components/Modal";
import { PhotoUploadField, photoUrl, type PhotoAsset } from "@/components/StudentPhoto";
import { useActionMutation, useCreateMutation, useListQuery, usePatchMutation, useRemoveMutation } from "@/app/api";
import { toast } from "@/components/Toast";
import { useCan } from "@/hooks/useAuth";
import { loc, rupees } from "@/utils/format";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { isYoutubeUrl } from "@/features/gallery/GalleryImageUpload";
import { CourseCategoriesSection } from "./CourseCategoriesSection";

const schema = z.object({
  title: z.string().min(2),
  slug: z.string().min(2),
  description: z.string().min(4),
  category: z.string().min(1),
  fee: z.coerce.number().min(0),
  duration: z.string().min(1),
  durationMonths: z.coerce.number().min(1),
  mode: z.enum(["offline", "online"]),
  discount: z.coerce.number().min(0).optional(),
  tags: z.string().optional(),
  certificate: z.string().optional(),
  demoVideo: z.string().optional(),
  active: z.boolean().optional(),
  popular: z.boolean().optional(),
});

type Form = z.infer<typeof schema>;

type SyllabusModule = { title: string; topics: string };

const emptyForm: Form = {
  title: "",
  slug: "",
  description: "",
  category: "",
  fee: 0,
  duration: "",
  durationMonths: 6,
  mode: "offline",
  discount: 0,
  tags: "",
  certificate: "",
  demoVideo: "",
  active: true,
  popular: false,
};

function categoryId(row: Record<string, unknown>) {
  const cat = row.category;
  if (cat && typeof cat === "object" && "_id" in (cat as object)) return String((cat as { _id: unknown })._id);
  return cat ? String(cat) : "";
}

function categoryLabel(row: Record<string, unknown>) {
  const cat = row.category;
  if (cat && typeof cat === "object" && "name" in (cat as object)) return loc((cat as { name: unknown }).name) || loc((cat as { slug?: unknown }).slug);
  return "—";
}

function instructorIds(row: Record<string, unknown>) {
  const list = Array.isArray(row.instructors) ? row.instructors : [];
  return list.map((item) => {
    if (item && typeof item === "object" && "_id" in (item as object)) return String((item as { _id: unknown })._id);
    return String(item);
  });
}

function syllabusFromRow(row: Record<string, unknown>): SyllabusModule[] {
  const list = Array.isArray(row.syllabus) ? row.syllabus : [];
  return list.map((mod) => {
    const m = mod as { title?: string; topics?: string[] };
    return {
      title: String(m.title ?? ""),
      topics: Array.isArray(m.topics) ? m.topics.join(", ") : "",
    };
  });
}

function rowToForm(row: Record<string, unknown>): Form {
  const tags = Array.isArray(row.tags) ? row.tags.map(String).join(", ") : "";
  return {
    title: loc(row.title),
    slug: String(row.slug ?? ""),
    description: loc(row.description),
    category: categoryId(row),
    fee: Number(row.fee ?? 0),
    duration: String(row.duration ?? ""),
    durationMonths: Number(row.durationMonths ?? 6),
    mode: (row.mode as "offline" | "online") ?? "offline",
    discount: Number(row.discount ?? 0),
    tags,
    certificate: String(row.certificate ?? ""),
    demoVideo: String(row.demoVideo ?? ""),
    active: row.active !== false,
    popular: Boolean(row.popular),
  };
}

function ViewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-white/5 py-2 sm:grid-cols-[140px_1fr]">
      <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">{label}</dt>
      <dd className="text-sm text-zinc-200">{value}</dd>
    </div>
  );
}

export function CoursesPage() {
  const canCreate = useCan("course:create");
  const canUpdate = useCan("course:update");
  const canDelete = useCan("course:delete");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debounced = useDebouncedValue(search);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewRow, setViewRow] = useState<Record<string, unknown> | null>(null);
  const [editRow, setEditRow] = useState<Record<string, unknown> | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [thumbnail, setThumbnail] = useState<PhotoAsset | null>(null);
  const [syllabus, setSyllabus] = useState<SyllabusModule[]>([]);
  const [facultyIds, setFacultyIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useListQuery({ resource: "courses", page, search: debounced });
  const categories = useListQuery({ resource: "categories", page: 1 });
  const staff = useListQuery({ resource: "staff", page: 1, limit: 100 });
  const [create, createState] = useCreateMutation();
  const [patch, patchState] = usePatchMutation();
  const [remove, removeState] = useRemoveMutation();
  const [act] = useActionMutation();
  const createForm = useForm<Form>({ resolver: zodResolver(schema), defaultValues: emptyForm });
  const editForm = useForm<Form>({ resolver: zodResolver(schema) });
  const rows = data?.data ?? [];
  const meta = data?.meta;
  const categoryRows = categories.data?.data ?? [];
  const staffRows = staff.data?.data ?? [];
  const formOpen = createOpen || Boolean(editRow);

  const facultyOptions = useMemo(
    () =>
      staffRows.map((s) => ({
        id: String(s._id),
        label: `${String(s.name)}${s.role ? ` · ${String(s.role)}` : ""}`,
      })),
    [staffRows],
  );

  function resetExtras(row?: Record<string, unknown> | null) {
    setFormError(null);
    if (!row) {
      setThumbnail(null);
      setSyllabus([]);
      setFacultyIds([]);
      return;
    }
    setThumbnail((row.thumbnail as PhotoAsset | undefined) ?? null);
    setSyllabus(syllabusFromRow(row));
    setFacultyIds(instructorIds(row));
  }

  async function saveCourse(values: Form, editing: Record<string, unknown> | null) {
    setFormError(null);
    const demo = values.demoVideo?.trim() || "";
    if (demo && !isYoutubeUrl(demo)) {
      setFormError("Demo video must be a YouTube link (youtube.com or youtu.be).");
      throw new Error("validation");
    }
    const body = {
      title: { en: values.title },
      description: { en: values.description },
      slug: values.slug,
      category: values.category,
      fee: values.fee,
      duration: values.duration,
      durationMonths: values.durationMonths,
      mode: values.mode,
      discount: values.discount ?? 0,
      tags: values.tags ? values.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      certificate: values.certificate?.trim() || undefined,
      demoVideo: demo || undefined,
      thumbnail: thumbnail ?? undefined,
      syllabus: syllabus
        .filter((m) => m.title.trim())
        .map((m) => ({
          title: m.title.trim(),
          topics: m.topics
            .split(/[,|\n]/)
            .map((t) => t.trim())
            .filter(Boolean),
        })),
      instructors: facultyIds,
      active: values.active ?? true,
      popular: values.popular ?? false,
    };
    if (editing) {
      await patch({ resource: "courses", id: String(editing._id), body }).unwrap();
    } else {
      await create({ resource: "courses", body }).unwrap();
    }
  }

  function CourseForm({
    form,
    onSubmit,
    busy,
    submitLabel,
  }: {
    form: ReturnType<typeof useForm<Form>>;
    onSubmit: (values: Form) => Promise<void>;
    busy: boolean;
    submitLabel: string;
  }) {
    const demoVideo = form.watch("demoVideo");
    return (
      <form
        className="grid max-h-[75vh] gap-3 overflow-y-auto pr-1"
        noValidate
        onSubmit={form.handleSubmit(async (values) => {
          try {
            await onSubmit(values);
            toast("Course saved");
          } catch (err) {
            if ((err as Error)?.message === "validation") return;
            toast((err as { data?: { message?: string } })?.data?.message ?? "Save failed", "error");
          }
        })}
      >
        {formError ? <p className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{formError}</p> : null}

        <PhotoUploadField
          label="Thumbnail"
          value={thumbnail}
          onChange={setThumbnail}
          folder="optech/courses"
          sizeGuide="1200 × 675 px (16:9)"
          previewAspect="16 / 9"
          hint="Course card / detail image on the website. JPG or PNG."
          buttonLabel="thumbnail"
        />

        <Field label="Title" error={form.formState.errors.title?.message}>
          <Input {...form.register("title")} />
        </Field>
        <Field label="Slug" error={form.formState.errors.slug?.message}>
          <Input {...form.register("slug")} />
        </Field>
        <Field label="Description" error={form.formState.errors.description?.message}>
          <Textarea rows={4} {...form.register("description")} />
        </Field>
        <Field label="Category" error={form.formState.errors.category?.message}>
          <Select {...form.register("category")}>
            <option value="">Select</option>
            {categoryRows.map((c) => (
              <option key={String(c._id)} value={String(c._id)}>
                {loc(c.name) || String(c.slug)}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Fee">
            <Input type="number" {...form.register("fee")} />
          </Field>
          <Field label="Discount">
            <Input type="number" {...form.register("discount")} />
          </Field>
          <Field label="Duration">
            <Input {...form.register("duration")} />
          </Field>
          <Field label="Months">
            <Input type="number" {...form.register("durationMonths")} />
          </Field>
        </div>
        <Field label="Mode">
          <Select {...form.register("mode")}>
            <option value="offline">Offline</option>
            <option value="online">Online</option>
          </Select>
        </Field>
        <Field label="Certificate text">
          <Input placeholder="e.g. Optech PGDCA Certificate" {...form.register("certificate")} />
        </Field>
        <Field label="Demo YouTube link">
          <Input type="url" placeholder="https://www.youtube.com/watch?v=…" {...form.register("demoVideo")} />
        </Field>
        {demoVideo && isYoutubeUrl(demoVideo) ? (
          <p className="text-xs text-emerald-400">Valid YouTube link</p>
        ) : demoVideo ? (
          <p className="text-xs text-red-300">Use a youtube.com or youtu.be link only</p>
        ) : null}
        <Field label="Tags">
          <Input placeholder="Popular, New" {...form.register("tags")} />
        </Field>

        <div className="rounded-xl border border-white/10 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Syllabus modules</p>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSyllabus((prev) => [...prev, { title: "", topics: "" }])}
            >
              Add module
            </Button>
          </div>
          {syllabus.length === 0 ? (
            <p className="text-xs text-zinc-500">No modules yet. Add modules shown on the course detail page.</p>
          ) : (
            <div className="grid gap-3">
              {syllabus.map((mod, index) => (
                <div key={index} className="grid gap-2 rounded-lg border border-white/8 bg-black/20 p-3">
                  <Field label={`Module ${index + 1} title`}>
                    <Input
                      value={mod.title}
                      onChange={(e) => {
                        const next = [...syllabus];
                        next[index] = { ...next[index], title: e.target.value };
                        setSyllabus(next);
                      }}
                      placeholder="e.g. Foundations"
                    />
                  </Field>
                  <Field label="Topics (comma separated)">
                    <Textarea
                      rows={2}
                      value={mod.topics}
                      onChange={(e) => {
                        const next = [...syllabus];
                        next[index] = { ...next[index], topics: e.target.value };
                        setSyllabus(next);
                      }}
                      placeholder="MS Office, Internet, Typing"
                    />
                  </Field>
                  <button
                    type="button"
                    className="justify-self-start font-mono text-[10px] uppercase tracking-[0.16em] text-danger"
                    onClick={() => setSyllabus((prev) => prev.filter((_, i) => i !== index))}
                  >
                    Remove module
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-white/10 p-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Faculty</p>
          {facultyOptions.length === 0 ? (
            <p className="text-xs text-zinc-500">No staff profiles yet. Add staff under Staff first.</p>
          ) : (
            <ul className="grid max-h-40 gap-2 overflow-y-auto sm:grid-cols-2">
              {facultyOptions.map((opt) => {
                const checked = facultyIds.includes(opt.id);
                return (
                  <li key={opt.id}>
                    <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-white/8 px-2 py-2 text-sm hover:bg-white/5">
                      <input
                        type="checkbox"
                        className="mt-1 accent-[#d4a22f]"
                        checked={checked}
                        onChange={() => {
                          setFacultyIds((prev) =>
                            checked ? prev.filter((id) => id !== opt.id) : [...prev, opt.id],
                          );
                        }}
                      />
                      <span>{opt.label}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-zinc-300">
          <label className="flex items-center gap-2">
            <input type="checkbox" {...form.register("active")} className="rounded border-white/20" />
            Published
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" {...form.register("popular")} className="rounded border-white/20" />
            Popular
          </label>
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : submitLabel}
        </Button>
      </form>
    );
  }

  return (
    <div>
      <PageHeader
        title="Courses"
        description="Publish programmes with thumbnail, syllabus, demo video, and faculty for the website."
        actions={
          canCreate ? (
            <Button
              type="button"
              onClick={() => {
                createForm.reset(emptyForm);
                resetExtras(null);
                setCreateOpen(true);
              }}
            >
              New course
            </Button>
          ) : null
        }
      />

      <CourseCategoriesSection />

      <div className="mb-3">
        <h2 className="font-sans text-base font-semibold text-zinc-100">All courses</h2>
        <p className="mt-1 text-sm text-zinc-500">Search and manage individual programmes.</p>
      </div>
      <Input
        className="mb-4 max-w-md"
        placeholder="Search title"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />
      {isLoading ? (
        <Skeleton className="h-48" />
      ) : isError ? (
        <EmptyState title="Could not load courses" body="Check the API connection." action={<Button onClick={() => refetch()}>Retry</Button>} />
      ) : rows.length === 0 ? (
        <EmptyState title="No courses" body="Create the first programme. A category is required." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="border-b border-white/8 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              <tr>
                <th className="px-4 py-3 text-left">Thumb</th>
                <th className="px-4 py-3 text-left">Title</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-left">Slug</th>
                <th className="px-4 py-3 text-left">Fee</th>
                <th className="px-4 py-3 text-left">Mode</th>
                <th className="px-4 py-3 text-left">Flags</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const thumb = photoUrl(row.thumbnail);
                return (
                  <tr key={String(row._id)} className="border-b border-white/5">
                    <td className="px-4 py-3">
                      {thumb ? (
                        <img src={thumb} alt="" className="h-10 w-16 rounded border border-white/10 object-cover" />
                      ) : (
                        <span className="text-xs text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{loc(row.title)}</td>
                    <td className="px-4 py-3">{categoryLabel(row)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{String(row.slug)}</td>
                    <td className="px-4 py-3">{rupees(row.fee)}</td>
                    <td className="px-4 py-3">{String(row.mode)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge value={row.active ? "published" : "draft"} />
                      {row.popular ? <span className="ml-2 text-accent">popular</span> : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button variant="ghost" onClick={() => setViewRow(row)}>
                          View
                        </Button>
                        {canUpdate ? (
                          <Button
                            variant="ghost"
                            onClick={() => {
                              editForm.reset(rowToForm(row));
                              resetExtras(row);
                              setEditRow(row);
                            }}
                          >
                            Edit
                          </Button>
                        ) : null}
                        {canCreate ? (
                          <Button
                            variant="ghost"
                            onClick={async () => {
                              try {
                                await act({ path: `courses/${String(row._id)}/duplicate` }).unwrap();
                                toast("Duplicated as unpublished copy");
                              } catch {
                                toast("Duplicate failed", "error");
                              }
                            }}
                          >
                            Duplicate
                          </Button>
                        ) : null}
                        {canDelete ? (
                          <button type="button" className="font-mono text-[10px] uppercase tracking-[0.16em] text-danger" onClick={() => setRemoveId(String(row._id))}>
                            Delete
                          </button>
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
            Page {meta.currentPage ?? page} of {meta.totalPages ?? 1} · {meta.totalItems ?? rows.length} courses
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Prev
            </Button>
            <Button variant="ghost" disabled={(meta.currentPage ?? 1) >= (meta.totalPages ?? 1)} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      ) : null}

      <Modal
        open={formOpen && createOpen}
        title="New course"
        onClose={() => {
          setCreateOpen(false);
          resetExtras(null);
        }}
      >
        <CourseForm
          form={createForm}
          busy={createState.isLoading}
          submitLabel="Save"
          onSubmit={async (values) => {
            await saveCourse(values, null);
            setCreateOpen(false);
            createForm.reset(emptyForm);
            resetExtras(null);
            refetch();
          }}
        />
      </Modal>

      <Modal
        open={Boolean(editRow)}
        title="Edit course"
        onClose={() => {
          setEditRow(null);
          resetExtras(null);
        }}
      >
        <CourseForm
          form={editForm}
          busy={patchState.isLoading}
          submitLabel="Update"
          onSubmit={async (values) => {
            await saveCourse(values, editRow);
            setEditRow(null);
            resetExtras(null);
            refetch();
          }}
        />
      </Modal>

      <Modal open={Boolean(viewRow)} title="Course details" onClose={() => setViewRow(null)}>
        {viewRow ? (
          <dl>
            {photoUrl(viewRow.thumbnail) ? (
              <ViewRow
                label="Thumbnail"
                value={<img src={photoUrl(viewRow.thumbnail)} alt="" className="h-24 w-40 rounded object-cover" />}
              />
            ) : null}
            <ViewRow label="Title" value={loc(viewRow.title)} />
            <ViewRow label="Slug" value={<span className="font-mono text-xs">{String(viewRow.slug)}</span>} />
            <ViewRow label="Category" value={categoryLabel(viewRow)} />
            <ViewRow label="Description" value={loc(viewRow.description)} />
            <ViewRow label="Fee" value={rupees(viewRow.fee)} />
            <ViewRow label="Discount" value={`${viewRow.discount ?? 0}%`} />
            <ViewRow label="Duration" value={`${viewRow.duration} (${viewRow.durationMonths} months)`} />
            <ViewRow label="Mode" value={String(viewRow.mode)} />
            <ViewRow label="Certificate" value={String(viewRow.certificate ?? "—")} />
            <ViewRow label="Demo video" value={String(viewRow.demoVideo ?? "—")} />
            <ViewRow
              label="Syllabus"
              value={
                Array.isArray(viewRow.syllabus) && viewRow.syllabus.length
                  ? (viewRow.syllabus as { title?: string }[]).map((m) => m.title).join(" · ")
                  : "—"
              }
            />
            <ViewRow
              label="Faculty"
              value={
                Array.isArray(viewRow.instructors) && viewRow.instructors.length
                  ? (viewRow.instructors as { name?: string }[])
                      .map((m) => (m && typeof m === "object" ? m.name : String(m)))
                      .filter(Boolean)
                      .join(", ")
                  : "—"
              }
            />
            <ViewRow
              label="Tags"
              value={Array.isArray(viewRow.tags) && viewRow.tags.length ? viewRow.tags.join(", ") : "—"}
            />
            <ViewRow label="Status" value={<StatusBadge value={viewRow.active ? "published" : "draft"} />} />
            <ViewRow label="Popular" value={viewRow.popular ? "Yes" : "No"} />
          </dl>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(removeId)}
        title="Delete course?"
        body="Are you sure you want to delete this course?"
        busy={removeState.isLoading}
        onClose={() => setRemoveId(null)}
        onConfirm={async () => {
          if (!removeId) return;
          try {
            await remove({ resource: "courses", id: removeId }).unwrap();
            toast("Deleted");
            setRemoveId(null);
          } catch {
            toast("Delete failed", "error");
          }
        }}
      />
    </div>
  );
}
