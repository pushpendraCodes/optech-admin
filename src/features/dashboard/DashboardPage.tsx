import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader, Skeleton, StatCard } from "@/components/Chrome";
import { useDashboardQuery, useListQuery } from "@/app/api";
import { Button } from "@/components/Button";
import { rupees } from "@/utils/format";

const PIE = ["#d4a22f", "#71717a", "#34d399", "#ef4444", "#fbbf24"];

export function DashboardPage() {
  const { data, isLoading, isError, refetch } = useDashboardQuery();
  const payments = useListQuery({ resource: "payments", page: 1 });
  const admissions = useListQuery({ resource: "admissions", page: 1 });
  const live = useListQuery({ resource: "live", page: 1 });
  const stats = data?.data ?? {};
  const payRows = payments.data?.data ?? [];
  const byStatus = ["paid", "pending", "failed", "refunded", "created"].map((status) => ({
    name: status,
    value: payRows.filter((p) => p.status === status).length,
  }));
  const volume = [
    { name: "Students", value: stats.totalStudents ?? 0 },
    { name: "Courses", value: stats.totalCourses ?? 0 },
    { name: "Admissions", value: stats.totalAdmissions ?? 0 },
    { name: "Batches", value: stats.activeBatches ?? 0 },
  ];

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }
  if (isError) {
    return (
      <div className="card p-8 text-center">
        <p>Could not load dashboard.</p>
        <Button className="mt-4" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Overview" description="Live institute metrics from the API — not demo numbers." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total students" value={stats.totalStudents ?? 0} />
        <StatCard label="Active students" value={stats.activeStudents ?? 0} />
        <StatCard label="Courses" value={stats.totalCourses ?? 0} />
        <StatCard label="Active batches" value={stats.activeBatches ?? 0} />
        <StatCard label="Admissions" value={stats.totalAdmissions ?? 0} />
        <StatCard label="Today admissions" value={stats.todayAdmissions ?? 0} />
        <StatCard label="Pending payments" value={stats.pendingPayments ?? 0} />
        <StatCard label="Revenue" value={rupees(stats.revenue ?? 0)} />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <article className="card p-5">
          <h2 className="mb-4 font-sans text-lg font-semibold">Volume snapshot</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volume}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="name" stroke="#71717a" fontSize={11} />
                <YAxis stroke="#71717a" fontSize={11} />
                <Tooltip contentStyle={{ background: "#121214", border: "1px solid #333" }} />
                <Bar dataKey="value" fill="#d4a22f" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
        <article className="card p-5">
          <h2 className="mb-4 font-sans text-lg font-semibold">Payment status</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byStatus} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                  {byStatus.map((_, i) => (
                    <Cell key={i} fill={PIE[i % PIE.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#121214", border: "1px solid #333" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>
        <article className="card p-5">
          <h2 className="mb-4 font-sans text-lg font-semibold">Recent admissions</h2>
          <ul className="space-y-3 text-sm">
            {(admissions.data?.data ?? []).slice(0, 8).map((a) => (
              <li key={String(a._id)} className="flex justify-between border-t border-white/8 pt-3">
                <span>{String(a.name)}</span>
                <span className="text-zinc-500">{String(a.status)}</span>
              </li>
            ))}
            {(admissions.data?.data ?? []).length === 0 ? <li className="text-zinc-500">No admissions yet.</li> : null}
          </ul>
        </article>
        <article className="card p-5">
          <h2 className="mb-4 font-sans text-lg font-semibold">Upcoming live</h2>
          <ul className="space-y-3 text-sm">
            {(live.data?.data ?? []).slice(0, 8).map((row) => (
              <li key={String(row._id)} className="flex justify-between border-t border-white/8 pt-3">
                <span>{String(row.title)}</span>
                <span className="text-accent">{row.isLive ? "LIVE" : String(row.startsAt ?? "").slice(0, 10)}</span>
              </li>
            ))}
            {(live.data?.data ?? []).length === 0 ? <li className="text-zinc-500">No sessions scheduled.</li> : null}
          </ul>
        </article>
      </div>
    </div>
  );
}
