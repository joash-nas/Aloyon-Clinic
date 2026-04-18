"use client";

type Row = {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
};

export default function RecentExpenses({
  rows,
  limit = 6,
  title = "Recent Expenses",
  wrap = "card",
  className,
}: {
  rows: Row[];
  limit?: number;
  title?: string;
  wrap?: "card" | "bare";
  className?: string;
}) {
  const list = [...rows]
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))
    .slice(0, limit);

  const peso = (n: number) =>
    `₱${Number(n || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const Content = (
    <div className={className}>
      <div className="mb-3 text-sm font-medium">{title}</div>

      {list.length === 0 ? (
        <div className="text-sm text-muted">No recent expenses.</div>
      ) : (
        <ul className="space-y-4">
          {list.map((r, idx) => (
            <li
              key={r.id}
              className="flex items-start justify-between gap-2 overflow-hidden"
            >
              {/* LEFT: dot + text */}
              <div className="flex min-w-0 items-start gap-3">
                {/* timeline dot/line */}
                <div className="flex flex-col items-center flex-shrink-0">
                  <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
                  {idx !== list.length - 1 && (
                    <span className="mt-1 w-px flex-1 bg-[var(--border)]" />
                  )}
                </div>

                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {r.description || r.category}
                  </div>
                  <div className="text-xs text-muted">
                    {new Date(r.date).toLocaleDateString()} • {r.category} •{" "}
                    {r.paymentMethod}
                  </div>
                </div>
              </div>

              {/* RIGHT: amount (fixed width, no overflow) */}
              <div className="ml-2 flex-shrink-0 whitespace-nowrap text-sm font-medium">
                {peso(r.amount)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return wrap === "bare" ? <>{Content}</> : <div className="card p-4">{Content}</div>;
}
