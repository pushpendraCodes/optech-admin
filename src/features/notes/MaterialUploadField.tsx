import { useRef } from "react";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { useUploadMutation } from "@/app/api";
import { toast } from "@/components/Toast";

export type MaterialAsset = {
  publicId?: string;
  url?: string;
  resourceType?: string;
  format?: string;
  bytes?: number;
};

const ACCEPT: Record<"pdf" | "doc" | "video", string> = {
  pdf: "application/pdf,.pdf",
  doc: ".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  video: "video/mp4,video/webm,video/*,.mp4",
};

const LABELS: Record<"pdf" | "doc" | "video", string> = {
  pdf: "PDF file",
  doc: "Document (DOC/DOCX)",
  video: "Video file",
};

export function assetUrl(asset: unknown) {
  if (asset && typeof asset === "object" && "url" in (asset as object)) {
    return String((asset as { url?: unknown }).url ?? "");
  }
  return "";
}

export function MaterialUploadField({
  materialType,
  value,
  onChange,
}: {
  materialType: "pdf" | "doc" | "video";
  value: MaterialAsset | null;
  onChange: (asset: MaterialAsset | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [upload, uploadState] = useUploadMutation();
  const url = assetUrl(value);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const ok =
      materialType === "pdf"
        ? file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
        : materialType === "doc"
          ? file.name.toLowerCase().match(/\.(doc|docx)$/) || file.type.includes("word")
          : file.type.startsWith("video/");
    if (!ok) {
      toast(`Please choose a valid ${materialType.toUpperCase()} file`, "error");
      return;
    }
    try {
      const res = await upload({ file, folder: "optech/notes" }).unwrap();
      onChange((res.data ?? null) as MaterialAsset | null);
      toast("File uploaded");
    } catch {
      toast("Upload failed", "error");
    }
  }

  return (
    <Field label={LABELS[materialType]}>
      <div className="flex flex-col gap-2">
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" className="truncate text-sm text-accent underline">
            {url}
          </a>
        ) : (
          <p className="text-xs text-zinc-500">No file uploaded yet.</p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT[materialType]}
          className="hidden"
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <Button type="button" variant="ghost" disabled={uploadState.isLoading} onClick={() => inputRef.current?.click()}>
          {uploadState.isLoading ? "Uploading…" : url ? "Replace file" : "Upload file"}
        </Button>
        {url ? (
          <button
            type="button"
            className="text-left font-mono text-[10px] uppercase tracking-[0.16em] text-danger"
            onClick={() => onChange(null)}
          >
            Remove file
          </button>
        ) : null}
      </div>
    </Field>
  );
}
