export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-sans text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-zinc-400">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="card p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">{label}</p>
      <p className="mt-2 font-sans text-2xl font-semibold">{value}</p>
    </article>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card px-6 py-16 text-center">
      <p className="font-sans text-lg font-semibold">{title}</p>
      <p className="mt-2 text-sm text-zinc-400">{body}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className = "h-10" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-white/5 ${className}`} />;
}

export function StatusBadge({ value }: { value: string }) {
  const tone =
    /^(active|paid|present|published|confirmed|success|admitted)$/i.test(value)
      ? "text-success"
      : /pending|late|hold|created/i.test(value)
        ? "text-warning"
        : /block|fail|cancel|absent|danger|closed/i.test(value)
          ? "text-danger"
          : "text-accent";
  return (
    <span className={`font-mono text-[10px] uppercase tracking-[0.16em] ${tone}`}>{value}</span>
  );
}
