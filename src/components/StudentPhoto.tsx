import { useRef } from "react";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { useUploadMutation } from "@/app/api";
import { toast } from "@/components/Toast";

export type PhotoAsset = {
  publicId?: string;
  url?: string;
  resourceType?: string;
  format?: string;
  bytes?: number;
  width?: number;
  height?: number;
};

export function photoUrl(photo: unknown) {
  if (photo && typeof photo === "object" && "url" in (photo as object)) {
    const url = (photo as { url?: unknown }).url;
    return url ? String(url) : "";
  }
  return "";
}

function initials(name?: string) {
  return (name ?? "?")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function StudentAvatar({
  photo,
  name,
  size = "md",
}: {
  photo?: unknown;
  name?: string;
  size?: "sm" | "md" | "lg";
}) {
  const url = photoUrl(photo);
  const sizes = { sm: "h-10 w-10 text-xs", md: "h-14 w-14 text-sm", lg: "h-24 w-24 text-xl" };
  const className = `${sizes[size]} shrink-0 rounded-full border border-white/10 object-cover`;

  if (url) {
    return <img src={url} alt={name ?? "Student photo"} className={className} />;
  }

  return (
    <div className={`${className} flex items-center justify-center bg-accent/10 font-mono text-accent`}>
      {initials(name)}
    </div>
  );
}

export function PhotoUploadField({
  label = "Student photo",
  value,
  onChange,
  folder = "optech/students",
  hint = "Use camera on mobile or pick a JPG/PNG from gallery.",
  sizeGuide,
  previewAspect,
  buttonLabel,
}: {
  label?: string;
  value: PhotoAsset | null;
  onChange: (photo: PhotoAsset | null) => void;
  folder?: string;
  hint?: string;
  /** e.g. "1200 × 500 px" — shown as required banner size */
  sizeGuide?: string;
  /** CSS aspect-ratio for preview frame, e.g. "12 / 5" */
  previewAspect?: string;
  buttonLabel?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [upload, uploadState] = useUploadMutation();

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("Please choose an image file", "error");
      return;
    }
    try {
      const res = await upload({ file, folder }).unwrap();
      onChange((res.data ?? null) as PhotoAsset | null);
      toast("Photo uploaded");
    } catch {
      toast("Photo upload failed", "error");
    }
  }

  const url = photoUrl(value);

  return (
    <Field label={label}>
      {sizeGuide ? (
        <div className="mb-3 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">Required size</p>
          <p className="mt-1 font-sans text-sm font-medium text-foreground">{sizeGuide}</p>
          <p className="mt-1 text-xs text-zinc-400">
            Export at this size (or 2×) so the website does not crop or hide the edges. JPG or PNG.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-start gap-4">
        {previewAspect ? (
          <div
            className="relative w-full max-w-[280px] overflow-hidden rounded-xl border border-white/10 bg-zinc-950"
            style={{ aspectRatio: previewAspect }}
          >
            {url ? (
              <img src={url} alt="" className="h-full w-full object-contain" />
            ) : (
              <div className="flex h-full items-center justify-center px-3 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-600">
                {sizeGuide ? `Preview · ${sizeGuide}` : "Preview"}
              </div>
            )}
          </div>
        ) : (
          <StudentAvatar photo={value} name="Student" size="lg" />
        )}
        <div className="flex min-w-[160px] flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              void handleFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <Button type="button" variant="ghost" disabled={uploadState.isLoading} onClick={() => inputRef.current?.click()}>
            {uploadState.isLoading
              ? "Uploading…"
              : value?.url
                ? buttonLabel
                  ? `Replace ${buttonLabel}`
                  : "Change photo"
                : buttonLabel
                  ? `Upload ${buttonLabel}`
                  : "Take / upload photo"}
          </Button>
          {value?.url ? (
            <button
              type="button"
              className="text-left font-mono text-[10px] uppercase tracking-[0.16em] text-danger"
              onClick={() => onChange(null)}
            >
              Remove
            </button>
          ) : null}
          {hint ? <p className="text-xs text-zinc-500">{hint}</p> : null}
        </div>
      </div>
    </Field>
  );
}
