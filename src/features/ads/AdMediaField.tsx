import { useRef } from "react";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { useUploadMutation } from "@/app/api";
import { toast } from "@/components/Toast";
import { photoUrl, type PhotoAsset } from "@/components/StudentPhoto";

const MAX_BYTES = 100 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov";

export function isAdVideo(asset: PhotoAsset | null | undefined) {
  if (!asset) return false;
  if (asset.resourceType === "video") return true;
  const url = asset.url?.toLowerCase() ?? "";
  return /\.(mp4|webm|mov)(\?|$)/i.test(url) || url.includes("/video/upload/");
}

export function AdMediaField({
  value,
  onChange,
  sizeGuide,
  hint,
}: {
  value: PhotoAsset | null;
  onChange: (asset: PhotoAsset | null) => void;
  sizeGuide?: string;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [upload, uploadState] = useUploadMutation();
  const url = photoUrl(value);
  const video = isAdVideo(value);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const ok =
      file.type.startsWith("image/") ||
      file.type.startsWith("video/") ||
      /\.(jpe?g|png|webp|mp4|webm|mov)$/i.test(file.name);
    if (!ok) {
      toast("Please choose an image (JPG/PNG/WebP) or video (MP4/WebM)", "error");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast("File must be 100 MB or smaller", "error");
      return;
    }
    try {
      const res = await upload({ file, folder: "optech/ads" }).unwrap();
      onChange((res.data ?? null) as PhotoAsset | null);
      toast(file.type.startsWith("video/") ? "Video uploaded" : "Image uploaded");
    } catch (err) {
      const message =
        err && typeof err === "object" && "data" in err
          ? String((err as { data?: { message?: string } }).data?.message ?? "")
          : "";
      toast(message || "Upload failed", "error");
    }
  }

  return (
    <Field label="Ad media (image or video)">
      {sizeGuide ? (
        <div className="mb-3 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">Recommended</p>
          <p className="mt-1 font-sans text-sm font-medium text-foreground">{sizeGuide}</p>
          <p className="mt-1 text-xs text-zinc-400">
            {hint || "Images or MP4/WebM videos up to 100 MB. Videos autoplay muted on the website."}
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-start gap-4">
        <div
          className="relative w-full max-w-[280px] overflow-hidden rounded-xl border border-white/10 bg-zinc-950"
          style={{ aspectRatio: "16 / 10" }}
        >
          {url ? (
            video ? (
              <video src={url} className="h-full w-full object-contain" muted playsInline controls preload="metadata" />
            ) : (
              <img src={url} alt="" className="h-full w-full object-contain" />
            )
          ) : (
            <div className="flex h-full items-center justify-center px-3 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-600">
              Preview · image or video
            </div>
          )}
        </div>
        <div className="flex min-w-[160px] flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              void handleFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <Button type="button" variant="ghost" disabled={uploadState.isLoading} onClick={() => inputRef.current?.click()}>
            {uploadState.isLoading ? "Uploading…" : url ? "Replace media" : "Upload image / video"}
          </Button>
          {url ? (
            <button
              type="button"
              className="text-left font-mono text-[10px] uppercase tracking-[0.16em] text-danger"
              onClick={() => onChange(null)}
            >
              Remove
            </button>
          ) : null}
          <p className="text-xs text-zinc-500">
            {url
              ? `${video ? "Video" : "Image"}${value?.bytes ? ` · ${(value.bytes / (1024 * 1024)).toFixed(1)} MB` : ""}`
              : "JPG, PNG, WebP, MP4, or WebM. Max 100 MB."}
          </p>
        </div>
      </div>
    </Field>
  );
}
