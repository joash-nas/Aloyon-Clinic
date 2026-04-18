// src/components/dashboard/SalesOverview.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type SalesSummary = {
  revenueToday: number;
  revenueMonth: number;
  completedOrdersToday: number;
  completedOrdersMonth: number;
  newOrdersToday: number;
  pendingOrdersToday: number;
  cancelledOrdersToday: number;
  avgOrderValueToday: number;
  avgOrderValueMonth: number;
};

export default function SalesOverview({ user }: { user: any }) {
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch("/api/sales/summary", { cache: "no-store" });
        const j = await res.json();
        if (!res.ok) {
          throw new Error(j?.error || `Failed to load (${res.status})`);
        }
        if (!cancelled) {
          setSummary(j as SalesSummary);
        }
      } catch (e: any) {
        if (!cancelled) {
          setErr(e.message || "Failed to load sales overview");
          setSummary(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const revenueToday = summary?.revenueToday ?? 0;
  const revenueMonth = summary?.revenueMonth ?? 0;
  const completedToday = summary?.completedOrdersToday ?? 0;
  const completedMonth = summary?.completedOrdersMonth ?? 0;
  const newOrdersToday = summary?.newOrdersToday ?? 0;
  const pendingOrdersToday = summary?.pendingOrdersToday ?? 0;
  const cancelledOrdersToday = summary?.cancelledOrdersToday ?? 0;
  const aovToday = summary?.avgOrderValueToday ?? 0;
  const aovMonth = summary?.avgOrderValueMonth ?? 0;

  const displayName =
    user?.full_name || user?.name || user?.email || "Sales";

  // For simple visual bar (order flow today)
  const orderTotalForBar =
    pendingOrdersToday + completedToday + cancelledOrdersToday || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">
          Hello sales, {firstName(displayName)} 📈
        </h1>
        <p className="text-sm text-muted">
          Snapshot of revenue, order performance, and average order value.
        </p>
      </div>

      {err && (
        <div className="rounded-2xl bg-red-50 text-red-800 text-sm px-4 py-3">
          {err}
        </div>
      )}

      {/* Top row: revenue + orders summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MoneyCard
          label="Revenue today"
          amount={revenueToday}
          detail="Completed orders today"
        />
        <MoneyCard
          label="Revenue this month"
          amount={revenueMonth}
          detail="Completed orders this month"
        />
        <StatCard
          label="Completed today"
          value={completedToday}
          detail="Orders marked as completed"
          highlightTone="ok"
        />
        <StatCard
          label="New orders today"
          value={newOrdersToday}
          detail="All statuses"
          highlightTone={newOrdersToday > 0 ? "warn" : "muted"}
        />
      </div>

      {/* Middle row: order flow + AOV */}
      <div className="grid gap-4 lg:grid-cols-[2fr_1.4fr]">
        {/* Order flow today */}
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">
              Order flow today
            </div>
          </div>

          {loading && !summary ? (
            <p className="text-sm text-muted">Loading order flow…</p>
          ) : orderTotalForBar === 0 ? (
            <p className="text-sm text-muted">
              No orders have been placed yet today.
            </p>
          ) : (
            <>
              <OrderFlowBar
                pending={pendingOrdersToday}
                completed={completedToday}
                cancelled={cancelledOrdersToday}
              />
              <div className="flex flex-wrap gap-4 text-[11px] text-muted mt-2">
                <LegendDot color="#fde68a" label="Pending / in progress" value={pendingOrdersToday} />
                <LegendDot color="#bbf7d0" label="Completed" value={completedToday} />
                <LegendDot color="#fecaca" label="Cancelled" value={cancelledOrdersToday} />
              </div>
            </>
          )}
        </div>

        {/* Average order value card */}
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">
              Average order value
            </div>
          </div>

          {loading && !summary ? (
            <p className="text-sm text-muted">Calculating…</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-6 text-sm">
                <div>
                  <div className="text-xs text-muted">Today</div>
                  <div className="text-2xl font-semibold">
                    ₱{aovToday.toLocaleString("en-PH", {
                      maximumFractionDigits: 2,
                    })}
                  </div>
                  <div className="text-[11px] text-muted">
                    Average value of completed orders today
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted">This month</div>
                  <div className="text-2xl font-semibold">
                    ₱{aovMonth.toLocaleString("en-PH", {
                      maximumFractionDigits: 2,
                    })}
                  </div>
                  <div className="text-[11px] text-muted">
                    Average across all completed orders this month
                  </div>
                </div>
              </div>

              {/* purely visual progress style bar */}
              <div className="mt-3 space-y-1">
                <div className="flex items-center justify-between text-[11px] text-muted">
                  <span>Completed orders this month</span>
                  <span>{completedMonth} order{completedMonth === 1 ? "" : "s"}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom row: shortcuts */}
      <div className="card p-4 space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">
          Quick shortcuts
        </div>
        <p className="text-xs text-muted">
          
        </p>
        <div className="flex flex-wrap gap-2 text-xs">
          <ChipLink href="/dashboard/sales">
            Sales reports
          </ChipLink>
          <ChipLink href="/dashboard/reports">
            Revenue breakdown
          </ChipLink>
          <ChipLink href="/dashboard/expenses">
            Expenses overview
          </ChipLink>
        </div>
      </div>
    </div>
  );
}

/* --- small components ----------------------------------------------------- */

function firstName(full: string): string {
  const parts = full.trim().split(/\s+/);
  return parts[0] || full;
}

function StatCard({
  label,
  value,
  detail,
  highlightTone = "muted",
}: {
  label: string;
  value: number;
  detail: string;
  highlightTone?: "ok" | "warn" | "danger" | "muted";
}) {
  const toneColor =
    highlightTone === "ok"
      ? "text-emerald-600"
      : highlightTone === "warn"
      ? "text-amber-600"
      : highlightTone === "danger"
      ? "text-red-600"
      : "text-slate-800";

  return (
    <div className="card p-4 space-y-1">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </div>
      <div className={`text-2xl font-semibold ${toneColor}`}>{value}</div>
      <div className="text-[11px] text-muted">{detail}</div>
    </div>
  );
}

function MoneyCard({
  label,
  amount,
  detail,
}: {
  label: string;
  amount: number;
  detail: string;
}) {
  return (
    <div className="card p-4 space-y-1">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </div>
      <div className="text-2xl font-semibold">
        ₱{amount.toLocaleString("en-PH", { maximumFractionDigits: 2 })}
      </div>
      <div className="text-[11px] text-muted">{detail}</div>
    </div>
  );
}

function OrderFlowBar({
  pending,
  completed,
  cancelled,
}: {
  pending: number;
  completed: number;
  cancelled: number;
}) {
  const total = pending + completed + cancelled || 0;
  if (!total) {
    return <div className="h-3 rounded-full bg-slate-100" />;
  }

  const pct = (n: number) => `${(n / total) * 100}%`;

  return (
    <div className="h-3 rounded-full bg-slate-100 overflow-hidden flex">
      {pending > 0 && (
        <div
          className="h-3"
          style={{ width: pct(pending), background: "#fde68a" }}
        />
      )}
      {completed > 0 && (
        <div
          className="h-3"
          style={{ width: pct(completed), background: "#bbf7d0" }}
        />
      )}
      {cancelled > 0 && (
        <div
          className="h-3"
          style={{ width: pct(cancelled), background: "#fecaca" }}
        />
      )}
    </div>
  );
}

function LegendDot({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="w-2 h-2 rounded-full"
        style={{ background: color }}
      />
      <span>
        {label} ({value})
      </span>
    </span>
  );
}

function SubtleLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-lg px-2 py-1 text-[11px] text-slate-600 border border-transparent hover:border-[var(--primary)] hover:text-[var(--primary)] bg-white/60 transition"
    >
      {children}
    </Link>
  );
}

function ChipLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-full px-3 py-1 text-[11px] text-slate-600 bg-slate-50 hover:bg-slate-100 hover:text-[var(--primary)] transition"
    >
      {children}
    </Link>
  );
}
