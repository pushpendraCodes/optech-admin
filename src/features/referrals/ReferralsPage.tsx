import { useState } from "react";
import { PageHeader, EmptyState, Skeleton, StatusBadge } from "@/components/Chrome";
import { Button } from "@/components/Button";
import { Input } from "@/components/Field";
import { useActionMutation, useListQuery } from "@/app/api";
import { toast } from "@/components/Toast";
import { useCan } from "@/hooks/useAuth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { isoDate } from "@/utils/format";

export function ReferralsPage() {
  const canMarkPaid = useCan("payment:write");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const { data, isLoading, isError, refetch } = useListQuery({
    resource: "referrals",
    page,
    search: debouncedSearch,
  });
  const [markPaid, markPaidState] = useActionMutation();
  const rows = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div>
      <PageHeader
        title="Referrals"
        description="Reward is given manually to the referrer. Mark paid after you have handed it over."
      />
      <div className="mb-4">
        <Input
          placeholder="Search code or phone"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton />
          <Skeleton />
        </div>
      ) : isError ? (
        <EmptyState title="Could not load referrals" body="Check that the API is running, then retry." action={<Button onClick={() => refetch()}>Retry</Button>} />
      ) : rows.length === 0 ? (
        <EmptyState title="No referrals yet" body="Referrals appear when a referral code is entered during admission confirmation." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-white/8 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Referrer</th>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">New student</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Payout</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const id = String(row._id);
                const referrer = row.referrer as { user?: { name?: string }; studentCode?: string } | undefined;
                const referee = row.refereeStudent as { user?: { name?: string } } | undefined;
                const payoutStatus = String(row.payoutStatus ?? "none");
                const isPaid = payoutStatus === "paid";

                return (
                  <tr key={id} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-3">
                      <p>{referrer?.user?.name ?? "—"}</p>
                      {referrer?.studentCode ? <p className="text-xs text-zinc-500">{referrer.studentCode}</p> : null}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{String(row.code ?? "—")}</td>
                    <td className="px-4 py-3">{referee?.user?.name ?? String(row.refereePhone ?? "—")}</td>
                    <td className="px-4 py-3">{String(row.refereePhone ?? "—")}</td>
                    <td className="px-4 py-3 text-zinc-400">{row.createdAt ? isoDate(String(row.createdAt)) : "—"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge value={isPaid ? "paid" : payoutStatus === "pending" ? "pending" : "none"} />
                    </td>
                    <td className="px-4 py-3">
                      {isPaid ? (
                        <span className="text-xs text-zinc-500">Reward given</span>
                      ) : canMarkPaid ? (
                        <Button
                          variant="ghost"
                          disabled={markPaidState.isLoading}
                          onClick={async () => {
                            try {
                              await markPaid({ path: `referrals/${id}/mark-paid`, method: "POST" }).unwrap();
                              toast("Marked as paid");
                              refetch();
                            } catch (err) {
                              toast((err as { data?: { message?: string } })?.data?.message ?? "Could not mark paid", "error");
                            }
                          }}
                        >
                          Mark paid
                        </Button>
                      ) : (
                        <span className="text-xs text-zinc-500">Pending</span>
                      )}
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
            <Button variant="ghost" disabled={(meta.currentPage ?? 1) >= (meta.totalPages ?? 1)} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
