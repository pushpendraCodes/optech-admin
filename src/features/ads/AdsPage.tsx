import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader, EmptyState, Skeleton, StatusBadge } from "@/components/Chrome";
import { Button } from "@/components/Button";
import { Field, Input, Select, Textarea } from "@/components/Field";
import { ConfirmDialog, Modal } from "@/components/Modal";
import { photoUrl, type PhotoAsset } from "@/components/StudentPhoto";
import { AdMediaField, isAdVideo } from "@/features/ads/AdMediaField";
import {
  useCreateMutation,
  useListQuery,
  usePatchMutation,
  useRemoveMutation,
  useSaveWebsiteSettingsMutation,
  useWebsiteSettingsQuery,
} from "@/app/api";
import { toast } from "@/components/Toast";
import { useCan } from "@/hooks/useAuth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const schema = z.object({
  title: z.string().min(2, "Title is required"),
  body: z.string().optional(),
  href: z.string().optional(),
  cta: z.string().optional(),
  slot: z.enum(["box1", "box2"]),
  active: z.boolean().optional(),
  sortOrder: z.coerce.number().optional(),
});

type Form = z.infer<typeof schema>;

function normalizeSlot(slot: unknown): "box1" | "box2" {
  if (slot === "box2" || slot === "side") return "box2";
  return "box1";
}

function slotLabel(slot: unknown) {
  return normalizeSlot(slot) === "box2" ? "Box 2" : "Box 1";
}

export function AdsPage() {
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
    extra: { kind: "ad" },
  });
  const { data: settingsData, refetch: refetchSettings } = useWebsiteSettingsQuery(undefined, {
    skip: !canWrite,
  });
  const [saveSettings, saveSettingsState] = useSaveWebsiteSettingsMutation();
  const [create, createState] = useCreateMutation();
  const [patch, patchState] = usePatchMutation();
  const [remove, removeState] = useRemoveMutation();
  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { slot: "box1", active: true, sortOrder: 0, cta: "View" },
  });
  const slot = form.watch("slot");
  const bannerSpec =
    slot === "box2"
      ? {
          sizeGuide: "600 × 500 px · Box 2",
          hint: "Box 2 sits on the homepage ad row. Image or video (max 100 MB).",
        }
      : {
          sizeGuide: "600 × 500 px · Box 1",
          hint: "Box 1 sits on the homepage ad row. Image or video (max 100 MB).",
        };
  const rows = data?.data ?? [];
  const meta = data?.meta;
  const site = settingsData?.data as Record<string, unknown> | undefined;
  const box1On = site?.adBox1Enabled !== false;
  const box2On = site?.adBox2Enabled !== false;

  async function toggleBox(box: "adBox1Enabled" | "adBox2Enabled", next: boolean) {
    try {
      await saveSettings({ [box]: next }).unwrap();
      toast(next ? `${box === "adBox1Enabled" ? "Box 1" : "Box 2"} visible on website` : `${box === "adBox1Enabled" ? "Box 1" : "Box 2"} hidden on website`);
      refetchSettings();
    } catch {
      toast("Could not update box visibility", "error");
    }
  }

  function openCreate() {
    setEditRow(null);
    setImage(null);
    setFormError(null);
    form.reset({ title: "", body: "", href: "", cta: "View", slot: "box1", active: true, sortOrder: 0 });
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
      cta: String(row.cta ?? "View"),
      slot: normalizeSlot(row.slot),
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
      setFormError("Upload an ad image or video.");
      return;
    }
    const body = {
      kind: "ad",
      title: values.title,
      body: values.body?.trim() || undefined,
      href: values.href?.trim() || undefined,
      cta: values.cta?.trim() || "View",
      slot: values.slot,
      image: image ?? editRow?.image,
      active: values.active !== false,
      sortOrder: values.sortOrder ?? 0,
    };
    try {
      if (editRow) {
        await patch({ resource: "cms", id: String(editRow._id), body }).unwrap();
        toast("Advertisement updated");
      } else {
        await create({ resource: "cms", body }).unwrap();
        toast("Advertisement saved");
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
        title="Advertisements"
        description="Two homepage boxes (Box 1 & Box 2). Upload image or video per ad, assign a box, and turn each box on/off for the website."
        actions={canWrite ? <Button type="button" onClick={openCreate}>New ad</Button> : null}
      />

      <div className="card mb-4 grid gap-4 p-4 sm:grid-cols-2">
        <label className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <span>
            <span className="block font-sans text-sm font-medium text-foreground">Show Box 1 on website</span>
            <span className="mt-1 block text-xs text-zinc-500">When off, Box 1 stays hidden even if ads are active.</span>
          </span>
          <input
            type="checkbox"
            className="mt-1 accent-accent"
            checked={box1On}
            disabled={!canWrite || saveSettingsState.isLoading}
            onChange={(e) => void toggleBox("adBox1Enabled", e.target.checked)}
          />
        </label>
        <label className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <span>
            <span className="block font-sans text-sm font-medium text-foreground">Show Box 2 on website</span>
            <span className="mt-1 block text-xs text-zinc-500">When off, Box 2 stays hidden even if ads are active.</span>
          </span>
          <input
            type="checkbox"
            className="mt-1 accent-accent"
            checked={box2On}
            disabled={!canWrite || saveSettingsState.isLoading}
            onChange={(e) => void toggleBox("adBox2Enabled", e.target.checked)}
          />
        </label>
        {!canWrite ? (
          <p className="text-xs text-zinc-500 sm:col-span-2">
            You need CMS write permission to toggle box visibility.
          </p>
        ) : null}
      </div>

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
        <EmptyState title="Could not load ads" body="Retry after the API is up." action={<Button onClick={() => refetch()}>Retry</Button>} />
      ) : rows.length === 0 ? (
        <EmptyState title="No advertisements" body="Create an ad with an image or video for Box 1 or Box 2." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-b border-white/8 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              <tr>
                <th className="px-4 py-3 text-left">Media</th>
                <th className="px-4 py-3 text-left">Title</th>
                <th className="px-4 py-3 text-left">Box</th>
                <th className="px-4 py-3 text-left">Link</th>
                <th className="px-4 py-3 text-left">Active</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const media = (row.image as PhotoAsset | undefined) ?? null;
                const url = photoUrl(media);
                const video = isAdVideo(media);
                return (
                  <tr key={String(row._id)} className="border-b border-white/5">
                    <td className="px-4 py-3">
                      {url ? (
                        video ? (
                          <video
                            src={url}
                            muted
                            playsInline
                            preload="metadata"
                            className="h-12 w-20 rounded border border-white/10 object-cover"
                          />
                        ) : (
                          <img src={url} alt="" className="h-12 w-20 rounded border border-white/10 object-cover" />
                        )
                      ) : (
                        <span className="text-xs text-zinc-500">No media</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">{String(row.title)}</td>
                    <td className="px-4 py-3 text-zinc-400">{slotLabel(row.slot)}</td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-xs text-zinc-500">{String(row.href ?? "—")}</td>
                    <td className="px-4 py-3"><StatusBadge value={row.active !== false ? "active" : "inactive"} /></td>
                    <td className="px-4 py-3">
                      {canWrite ? (
                        <div className="flex gap-2">
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

      <Modal open={open} title={editRow ? "Edit advertisement" : "New advertisement"} onClose={() => { setOpen(false); setEditRow(null); }}>
        <form
          className="grid max-h-[75vh] gap-3 overflow-y-auto pr-1"
          noValidate
          onSubmit={form.handleSubmit((v) => void save(v), () => setFormError("Fix the highlighted fields."))}
        >
          {formError ? <p className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{formError}</p> : null}

          <Field label="Advertisement box">
            <Select {...form.register("slot")}>
              <option value="box1">Box 1</option>
              <option value="box2">Box 2</option>
            </Select>
          </Field>

          <AdMediaField
            value={image}
            onChange={setImage}
            sizeGuide={bannerSpec.sizeGuide}
            hint={bannerSpec.hint}
          />

          <Field label="Title" error={form.formState.errors.title?.message}>
            <Input {...form.register("title")} />
          </Field>
          <Field label="Body">
            <Textarea rows={3} {...form.register("body")} />
          </Field>
          <Field label="Link URL">
            <Input placeholder="/courses or https://…" {...form.register("href")} />
          </Field>
          <Field label="CTA label">
            <Input placeholder="View" {...form.register("cta")} />
          </Field>
          <Field label="Sort order">
            <Input type="number" {...form.register("sortOrder")} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...form.register("active")} className="accent-accent" />
            Active (this ad can appear in its box)
          </label>

          <Button type="submit" disabled={createState.isLoading || patchState.isLoading}>
            {createState.isLoading || patchState.isLoading ? "Saving…" : editRow ? "Update" : "Save"}
          </Button>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(removeId)}
        title="Delete advertisement?"
        body="This removes the ad from the public site."
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
