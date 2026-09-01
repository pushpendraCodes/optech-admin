import { useState } from "react";
import { MessageSquare, Phone } from "lucide-react";
import { PageHeader, EmptyState, Skeleton, StatusBadge } from "@/components/Chrome";
import { Button } from "@/components/Button";
import { Input, Select } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { useListQuery, usePatchMutation } from "@/app/api";
import { toast } from "@/components/Toast";
import { useCan } from "@/hooks/useAuth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { isoDate } from "@/utils/format";
import { whatsappLink } from "@/utils/whatsapp";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "closed", label: "Closed" },
];

export function EnquiriesPage() {
  const canUpdate = useCan("admission:write");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const debouncedSearch = useDebouncedValue(search);
  const { data, isLoading, isError, refetch } = useListQuery({
    resource: "enquiries",
    page,
    search: debouncedSearch,
    extra: { status },
  });
  const [patch, patchState] = usePatchMutation();
  const rows = data?.data ?? [];
  const meta = data?.meta;

  async function updateStatus(id: string, next: "new" | "contacted" | "closed") {
    try {
      await patch({ resource: "enquiries", id, body: { status: next } }).unwrap();
      toast(`Marked as ${next}`);
      refetch();
      if (detail && String(detail._id) === id) {
        setDetail({ ...detail, status: next });
      }
    } catch (err) {
      toast((err as { data?: { message?: string } })?.data?.message ?? "Could not update", "error");
    }
  }

  return (
    <div>
      <PageHeader
        title="Enquiries"
        description="Contact form submissions from the website. Follow up by phone, email, or WhatsApp."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_180px]">
        <Input
          placeholder="Search name, email, phone, course, message"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value || "all"} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton />
          <Skeleton />
        </div>
      ) : isError ? (
        <EmptyState
          title="Could not load enquiries"
          body="Check that the API is running, then retry."
          action={<Button onClick={() => refetch()}>Retry</Button>}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No enquiries yet"
          body="Submissions from the website contact form will appear here."
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="border-b border-white/8 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Course</th>
                <th className="px-4 py-3 font-medium">Message</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const id = String(row._id);
                const current = String(row.status ?? "new");
                const phone = String(row.phone ?? "");
                const message = String(row.message ?? "");
                const wa = phone ? whatsappLink(phone, `Hello ${row.name}, regarding your Optech enquiry for ${row.course}.`) : null;

                return (
                  <tr key={id} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium">{String(row.name ?? "—")}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p>{phone || "—"}</p>
                      <p className="text-xs text-zinc-500">{String(row.email ?? "—")}</p>
                    </td>
                    <td className="px-4 py-3">{String(row.course ?? "—")}</td>
                    <td className="max-w-[220px] px-4 py-3">
                      <p className="truncate text-zinc-400">{message || "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{row.createdAt ? isoDate(String(row.createdAt)) : "—"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge value={current} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1">
                        <Button variant="ghost" onClick={() => setDetail(row)}>
                          View
                        </Button>
                        {wa ? (
                          <a
                            href={wa}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-xl px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-emerald-400 hover:bg-white/5"
                          >
                            <Phone size={12} />
                            WA
                          </a>
                        ) : null}
                        {canUpdate && current !== "contacted" ? (
                          <Button
                            variant="ghost"
                            disabled={patchState.isLoading}
                            onClick={() => void updateStatus(id, "contacted")}
                          >
                            Contacted
                          </Button>
                        ) : null}
                        {canUpdate && current !== "closed" ? (
                          <Button
                            variant="ghost"
                            disabled={patchState.isLoading}
                            onClick={() => void updateStatus(id, "closed")}
                          >
                            Close
                          </Button>
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
            Page {meta.currentPage} of {meta.totalPages} · {meta.totalItems} items
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Prev
            </Button>
            <Button
              variant="ghost"
              disabled={(meta.currentPage ?? 1) >= (meta.totalPages ?? 1)}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title="Enquiry details">
        {detail ? (
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Name</p>
              <p className="mt-1 font-medium">{String(detail.name ?? "—")}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Phone</p>
                <p className="mt-1">{String(detail.phone ?? "—")}</p>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Email</p>
                <p className="mt-1 break-all">{String(detail.email ?? "—")}</p>
              </div>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Course interest</p>
              <p className="mt-1">{String(detail.course ?? "—")}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Message</p>
              <p className="mt-1 whitespace-pre-wrap text-zinc-300">{String(detail.message ?? "—")}</p>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              {detail.phone ? (
                <a
                  href={whatsappLink(
                    String(detail.phone),
                    `Hello ${detail.name}, regarding your Optech enquiry for ${detail.course}.`,
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-emerald-400"
                >
                  <MessageSquare size={14} />
                  WhatsApp
                </a>
              ) : null}
              {detail.email ? (
                <a
                  href={`mailto:${detail.email}?subject=${encodeURIComponent(`Re: Optech enquiry — ${detail.course}`)}`}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-300 hover:bg-white/5"
                >
                  Email
                </a>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
