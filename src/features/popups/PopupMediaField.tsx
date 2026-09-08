import { useRef } from "react";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { useUploadMutation } from "@/app/api";
import { toast } from "@/components/Toast";
import { photoUrl, type PhotoAsset } from "@/components/StudentPhoto";

const MAX_BYTES = 100 * 1024 * 1024;
const MAX_ITEMS = 12;
const ACCEPT = "image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov";

export function isVideoAsset(asset: PhotoAsset | null | undefined) {
  if (!asset) return false;
  if (asset.resourceType === "video") return true;
  const url = asset.url?.toLowerCase() ?? "";
  return /\.(mp4|webm|mov)(\?|$)/i.test(url) || url.includes("/video/upload/");
}

export function PopupMediaField({
  value,
  onChange,
}: {
  value: PhotoAsset[];
  onChange: (assets: PhotoAsset[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [upload, uploadState] = useUploadMutation();

  async function handleFiles(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    if (!files.length) return;

    const room = MAX_ITEMS - value.length;
    if (room <= 0) {
      toast(`You can upload up to ${MAX_ITEMS} media files`, "error");
      return;
    }

    const selected = files.slice(0, room);
    const next = [...value];

    for (const file of selected) {
      const ok =
        file.type.startsWith("image/") ||
        file.type.startsWith("video/") ||
        /\.(jpe?g|png|webp|mp4|webm|mov)$/i.test(file.name);
      if (!ok) {
        toast(`${file.name}: use JPG/PNG/WebP or MP4/WebM`, "error");
        continue;
      }
      if (file.size > MAX_BYTES) {
        toast(`${file.name}: must be 100 MB or smaller`, "error");
        continue;
      }
      try {
        const res = await upload({ file, folder: "optech/popups" }).unwrap();
        const asset = (res.data ?? null) as PhotoAsset | null;
        if (asset?.url) next.push(asset);
      } catch (err) {
        const message =
          err && typeof err === "object" && "data" in err
            ? String((err as { data?: { message?: string } }).data?.message ?? "")
            : "";
        toast(message || `Upload failed: ${file.name}`, "error");
      }
    }

    onChange(next);
    if (next.length > value.length) toast(`${next.length - value.length} media added`);
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    onChange(next);
  }

  return (
    <Field label="Popup media (images / videos)">
      <div className="mb-3 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2.5">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">Multiple media</p>
        <p className="mt-1 font-sans text-sm font-medium text-foreground">
          Upload several images or videos · each up to 100 MB
        </p>
        <p className="mt-1 text-xs text-zinc-400">
          Website popup auto-scrolls through all media. Videos autoplay muted. Order here is the slide order.
        </p>
      </div>

      {value.length ? (
        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          {value.map((item, index) => {
            const url = photoUrl(item);
            const video = isVideoAsset(item);
            return (
              <div key={`${url}-${index}`} className="rounded-xl border border-white/10 bg-zinc-950 p-2">
                <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-black">
                  {url ? (
                    video ? (
                      <video src={url} className="h-full w-full object-contain" muted playsInline controls preload="metadata" />
                    ) : (
                      <img src={url} alt="" className="h-full w-full object-contain" />
                    )
                  ) : null}
                  <span className="absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-accent">
                    {index + 1}/{value.length} · {video ? "Video" : "Image"}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button type="button" variant="ghost" disabled={index === 0} onClick={() => move(index, -1)}>
                    Up
                  </Button>
                  <Button type="button" variant="ghost" disabled={index === value.length - 1} onClick={() => move(index, 1)}>
                    Down
                  </Button>
                  <Button type="button" variant="danger" onClick={() => removeAt(index)}>
                    Remove
                  </Button>
                </div>
                {item.bytes ? (
                  <p className="mt-1 text-[11px] text-zinc-500">{(item.bytes / (1024 * 1024)).toFixed(1)} MB</p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mb-3 text-xs text-zinc-500">No media yet. Add at least one image or video.</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="ghost"
        disabled={uploadState.isLoading || value.length >= MAX_ITEMS}
        onClick={() => inputRef.current?.click()}
      >
        {uploadState.isLoading ? "Uploading…" : value.length ? "Add more media" : "Upload images / videos"}
      </Button>
      <p className="mt-2 text-xs text-zinc-500">
        JPG, PNG, WebP, MP4, or WebM. Max 100 MB each · up to {MAX_ITEMS} files.
      </p>
    </Field>
  );
}
