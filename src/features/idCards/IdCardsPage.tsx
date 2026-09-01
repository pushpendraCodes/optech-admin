import { useState } from "react";
import { PageHeader, EmptyState, Skeleton } from "@/components/Chrome";
import { Button } from "@/components/Button";
import { Field, Input } from "@/components/Field";
import { useListQuery, useDownloadIdCardPdfMutation } from "@/app/api";
import { toast } from "@/components/Toast";
import { downloadBlob } from "@/utils/downloadBlob";
import { photoUrl } from "@/components/StudentPhoto";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

export function IdCardsPage() {
  const [downloadIdCard] = useDownloadIdCardPdfMutation();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debounced = useDebouncedValue(search);
  const { data, isLoading, isError, refetch } = useListQuery({
    resource: "students",
    page,
    search: debounced,
    limit: 12,
  });
  const rows = data?.data ?? [];
  const meta = data?.meta;

  async function download(id: string, code: string) {
    try {
      const blob = await downloadIdCard(id).unwrap();
      downloadBlob(blob, `${code}-id.pdf`);
      toast("ID card downloaded");
    } catch {
      toast("Download failed", "error");
    }
  }

  return (
    <div>
      <PageHeader
        title="Digital ID cards"
        description="Search by name, student ID, mobile, or email — then download the print PDF."
      />

      <div className="mb-4 max-w-md">
        <Field label="Search students">
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Name, student ID, mobile…"
          />
        </Field>
      </div>

      {isLoading ? (
        <Skeleton className="h-40" />
      ) : isError ? (
        <EmptyState title="Could not load students" body="Retry after the API is up." action={<Button onClick={() => refetch()}>Retry</Button>} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={debounced ? "No students match" : "No cards yet"}
          body={debounced ? "Try another name or student ID." : "Confirm an admission first."}
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => {
            const user = row.user as { name?: string; phone?: string; email?: string } | undefined;
            const img = photoUrl(row.photo);
            return (
              <article
                key={String(row._id)}
                className="overflow-hidden rounded-2xl border border-[#5c4033]/40 bg-[#faf0e6] shadow-[0_12px_40px_-20px_rgba(0,0,0,0.55)]"
              >
                <div className="flex items-center gap-3 bg-[#6b4423] px-4 py-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#d4a22f]/60 bg-[#3d2818] font-mono text-[10px] text-[#d4a22f]">
                    OP
                  </div>
                  <div>
                    <p className="font-sans text-sm font-bold uppercase tracking-wide text-white">Optech</p>
                    <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/80">Computer Institute</p>
                  </div>
                </div>
                <div className="px-4 pb-4 pt-5">
                  <div className="mx-auto mb-4 aspect-[5/6] w-28 overflow-hidden rounded border border-[#6b4423]/30 bg-[#e8d5c4]">
                    {img ? (
                      <img src={img} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center font-mono text-lg text-[#6b4423]">
                        {(user?.name ?? "ST").slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <dl className="space-y-1.5 text-sm text-[#4a3228]">
                    <div className="flex gap-2">
                      <dt className="w-16 shrink-0 font-semibold">Name</dt>
                      <dd>{user?.name ?? "Student"}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-16 shrink-0 font-semibold">Mobile</dt>
                      <dd>{user?.phone ? String(user.phone) : "—"}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-16 shrink-0 font-semibold">ID</dt>
                      <dd className="font-mono text-xs">{String(row.studentCode)}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-16 shrink-0 font-semibold">Address</dt>
                      <dd className="text-xs leading-snug">{String(row.address ?? "—")}</dd>
                    </div>
                  </dl>
                  <Button className="mt-4 w-full" variant="ghost" onClick={() => download(String(row._id), String(row.studentCode))}>
                    Download PDF
                  </Button>
                </div>
                <div className="h-2.5 bg-[#6b4423]" />
              </article>
            );
          })}
        </div>
      )}

      {meta ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500">
          <span>
            Page {meta.currentPage ?? page} of {meta.totalPages ?? 1} · {meta.totalItems ?? 0} students
          </span>
          {(meta.totalPages ?? 1) > 1 ? (
            <div className="flex gap-2">
              <Button type="button" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={page >= (meta.totalPages ?? 1)}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
