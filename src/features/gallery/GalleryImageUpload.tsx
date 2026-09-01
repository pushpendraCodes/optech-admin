import { useRef } from "react";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { useUploadMutation } from "@/app/api";
import { toast } from "@/components/Toast";
import type { MaterialAsset } from "@/features/notes/MaterialUploadField";
import { assetUrl } from "@/features/notes/MaterialUploadField";

export function GalleryImageUpload({
  label,
  value,
  onChange,
  multiple = false,
}: {
  label: string;
  value: MaterialAsset | MaterialAsset[] | null;
  onChange: (v: MaterialAsset | MaterialAsset[] | null) => void;
  multiple?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [upload, uploadState] = useUploadMutation();

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) {
      toast("Choose image files only", "error");
      return;
    }
    try {
      const uploaded: MaterialAsset[] = [];
      for (const file of list) {
        const res = await upload({ file, folder: "optech/gallery" }).unwrap();
        if (res.data) uploaded.push(res.data as MaterialAsset);
      }
      if (multiple) {
        const prev = Array.isArray(value) ? value : value ? [value] : [];
        onChange([...prev, ...uploaded]);
      } else {
        onChange(uploaded[0] ?? null);
      }
      toast("Uploaded");
    } catch {
      toast("Upload failed", "error");
    }
  }

  const previews = multiple
    ? (Array.isArray(value) ? value : [])
    : value && !Array.isArray(value) && assetUrl(value)
      ? [value]
      : [];

  return (
    <Field label={label}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <Button type="button" variant="ghost" disabled={uploadState.isLoading} onClick={() => inputRef.current?.click()}>
        {uploadState.isLoading ? "Uploading…" : multiple ? "Add photos" : value ? "Replace cover" : "Upload cover"}
      </Button>
      {previews.length ? (
        <ul className="mt-3 grid grid-cols-3 gap-2">
          {previews.map((p, i) => (
            <li key={`${assetUrl(p)}-${i}`} className="relative aspect-square overflow-hidden rounded border border-white/10">
              <img src={assetUrl(p)} alt="" className="h-full w-full object-cover" />
              {multiple ? (
                <button
                  type="button"
                  className="absolute right-1 top-1 rounded bg-black/70 px-1 text-[10px] text-red-300"
                  onClick={() => {
                    const arr = Array.isArray(value) ? [...value] : [];
                    arr.splice(i, 1);
                    onChange(arr);
                  }}
                >
                  ×
                </button>
              ) : (
                <button type="button" className="mt-1 text-[10px] text-danger" onClick={() => onChange(null)}>Remove</button>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </Field>
  );
}

export function isYoutubeUrl(url: string) {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./, "");
    return host === "youtu.be" || host === "youtube.com" || host === "m.youtube.com";
  } catch {
    return false;
  }
}

export function youtubeThumb(id: string) {
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}
