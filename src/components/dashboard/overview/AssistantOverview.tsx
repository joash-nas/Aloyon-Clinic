/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type StatusBucket = {
  pending: number;
  confirmed: number;
  checkedIn: number;
  done: number;
  cancelled: number;
};

type NextAppt = {
  id: string;
  time: string; // ISO string
  patientName: string;
  reason: string | null;
  status: string;
};

type QueueItem = {
  id: string;
  time: string; // ISO string
  patientName: string;
  status: string;
  reason: string | null;
};

type NextOrder = {
  id: string;
  orderNumber: string;
  patientName: string | null;
  total: number;
  status: string;
};

type StockItem = {
  name: string;
  slug: string;
  qty: number;
};

type AssistantSummary = {
  todayAppointmentsTotal: number;
  todayByStatus: StatusBucket;
  inClinicNow: number;
  completedToday: number;
  cancellationsToday: number;
  nextAppointment: NextAppt | null;
  upcomingToday: QueueItem[]; // already sorted after next
  shopOrders: {
    pendingPickup: number;
    todayNew: number;
    completedToday: number;
  };
  stockSignals: {
    critical: number; // qty ≤ 2
    low: number; // 3–10
    topCritical: StockItem[];
  };
  totalPatients: number;
};

export default function AssistantOverview({ user }: { user: any }) {
  const [summary, setSummary] = useState<AssistantSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch("/api/staff/summary", { cache: "no-store" });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(
            j.error || `Failed to load staff summary (${res.status})`
          );
        }
        const data = (await res.json()) as AssistantSummary;
        if (!cancelled) setSummary(data);
      } catch (e: unknown) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "Failed to load overview");
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

  const todayTotal = summary?.todayAppointmentsTotal ?? 0;
  const inClinicNow =
    summary?.inClinicNow ?? summary?.todayByStatus?.checkedIn ?? 0;
  const doneToday =
    summary?.completedToday ?? summary?.todayByStatus?.done ?? 0;
  const cancelledToday =
    summary?.cancellationsToday ?? summary?.todayByStatus?.cancelled ?? 0;

  const statusBuckets: StatusBucket = summary?.todayByStatus ?? {
    pending: 0,
    confirmed: 0,
    checkedIn: 0,
    done: 0,
    cancelled: 0,
  };

  const totalForChart =
    statusBuckets.pending +
      statusBuckets.confirmed +
      statusBuckets.checkedIn +
      statusBuckets.done +
      statusBuckets.cancelled || 0;

  const nextAppt = summary?.nextAppointment ?? null;
  const upcomingShort = (summary?.upcomingToday ?? []).slice(0, 3);
  const orders = summary?.shopOrders;
  const stock = summary?.stockSignals;
  const totalPatients = summary?.totalPatients ?? 0;

  const pendingPickup = orders?.pendingPickup ?? 0;
  const todayNew = orders?.todayNew ?? 0;
  const completedOrdersToday = orders?.completedToday ?? 0;

  const displayName =
    user?.full_name || user?.name || user?.email || "Assistant";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">
          Hello assistant, {firstName(displayName)} 👋
        </h1>
        <p className="text-sm text-muted">
          Overview of appointments, revenue, inventory, and patients.
        </p>
      </div>

      {err && (
        <div className="rounded-2xl bg-red-50 text-red-800 text-sm px-4 py-3">
          {err}
        </div>
      )}

      {/* Top stats row: 4 key numbers */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Today's appointments"
          value={todayTotal}
          detail="All doctors / all time slots"
        />
        <StatCard
          label="Completed today"
          value={doneToday}
          highlightTone="ok"
          detail="Finished visits today"
        />
        <StatCard
          label="Pending shop orders"
          value={pendingPickup}
          highlightTone={pendingPickup > 0 ? "warn" : "muted"}
          detail="Pending / preparing / ready"
        />
        <StatCard
          label="Total patients"
          value={totalPatients}
          highlightTone="muted"
          detail="All patient accounts in the system"
        />
      </div>

      {/* Today’s schedule (all docs) */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">
            Today&apos;s schedule (all doctors)
          </div>
          <SubtleLink href="/dashboard/appointments/assistant">
            Open appointments
          </SubtleLink>
        </div>

        {loading && !summary ? (
          <p className="text-sm text-muted">Loading schedule…</p>
        ) : totalForChart === 0 ? (
          <p className="text-sm text-muted">
            No appointments on the calendar for today.
          </p>
        ) : (
          <>
            <div className="mt-1">
              <StackedStatusBar buckets={statusBuckets} />
            </div>

            <div className="flex flex-wrap gap-3 text-[11px] text-muted mt-2">
              <StatusLegend
                color="#e5e7eb"
                label="Pending"
                value={statusBuckets.pending}
              />
              <StatusLegend
                color="#dbeafe"
                label="Confirmed"
                value={statusBuckets.confirmed}
              />
              <StatusLegend
                color="#fef3c7"
                label="Checked-in"
                value={statusBuckets.checkedIn}
              />
              <StatusLegend
                color="#dcfce7"
                label="Done"
                value={statusBuckets.done}
              />
              <StatusLegend
                color="#fee2e2"
                label="Cancelled"
                value={statusBuckets.cancelled}
              />
            </div>
          </>
        )}
      </div>

      {/* Orders + stock + small next patients box */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Revenue & orders-ish box (assistant-focused) */}
        <div className="card p-5 space-y-3 lg:col-span-1">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">
              Shop orders today
            </div>
            <SubtleLink href="/dashboard/shop-orders">
              View shop orders
            </SubtleLink>
          </div>

          {loading && !summary ? (
            <p className="text-sm text-muted">Loading orders…</p>
          ) : !orders ? (
            <p className="text-sm text-muted">No order data available yet.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-4 text-sm">
                <div>
                  <div className="text-lg font-semibold">{todayNew}</div>
                  <div className="text-[11px] text-muted">New today</div>
                </div>
                <div>
                  <div className="text-lg font-semibold">
                    {completedOrdersToday}
                  </div>
                  <div className="text-[11px] text-muted">
                    Completed today
                  </div>
                </div>
              </div>

              <p className="mt-2 text-[11px] text-muted">
                
              </p>
            </>
          )}
        </div>

        {/* Inventory health box */}
        <div className="card p-5 space-y-3 lg:col-span-1">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">
              Inventory health
            </div>
            <SubtleLink href="/dashboard/products">
              Open inventory
            </SubtleLink>
          </div>

          {loading && !summary ? (
            <p className="text-sm text-muted">Checking stock levels…</p>
          ) : !stock ? (
            <p className="text-sm text-muted">
              No stock signals yet. Inventory might not be configured.
            </p>
          ) : stock.critical === 0 && stock.low === 0 ? (
            <p className="text-sm text-muted">
              All stocked items look healthy right now.
            </p>
          ) : (
            <>
              <div className="flex items-baseline gap-4 text-sm">
                <div>
                  <div className="text-lg font-semibold text-red-600">
                    {stock.critical}
                  </div>
                  <div className="text-[11px] text-muted">
                    Critically low (≤ 2 pcs)
                  </div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-amber-600">
                    {stock.low}
                  </div>
                  <div className="text-[11px] text-muted">
                    Running low (3–10 pcs)
                  </div>
                </div>
              </div>

              {stock.topCritical?.length > 0 && (
                <div className="mt-2 space-y-1 text-xs">
                  {stock.topCritical.map((p) => (
                    <div
                      key={p.slug}
                      className="flex items-center justify-between"
                    >
                      <div className="truncate max-w-[9rem]">{p.name}</div>
                      <span className="inline-flex items-center gap-1 text-[11px]">
                        <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
                        {p.qty} pcs
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Small next patients box (optional) */}
        <div className="card p-5 space-y-3 lg:col-span-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">
            Next patients in line
          </div>

          {loading && !summary ? (
            <p className="text-sm text-muted">Finding next appointment…</p>
          ) : !nextAppt ? (
            <p className="text-sm text-muted">
              No upcoming appointment in the queue.
            </p>
          ) : (
            <>
              <div className="rounded-2xl border border-[var(--border)] px-3 py-3 bg-[var(--muted)]/40 space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">
                      {nextAppt.patientName}
                    </div>
                    <div className="text-xs text-muted">
                      {formatTime(nextAppt.time)} •{" "}
                      {prettyStatus(nextAppt.status)}
                    </div>
                  </div>
                  <StatusChip status={nextAppt.status} />
                </div>
                {nextAppt.reason && (
                  <p className="text-xs text-muted mt-1 line-clamp-2">
                    {nextAppt.reason}
                  </p>
                )}
              </div>

              {upcomingShort.length > 0 && (
                <div className="space-y-1 text-xs">
                  {upcomingShort.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between py-1 border-b border-[var(--border)]/40 last:border-b-0"
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate max-w-[9rem]">
                          {a.patientName}
                        </div>
                        {a.reason && (
                          <div className="text-[11px] text-muted truncate max-w-[11rem]">
                            {a.reason}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] text-muted">
                          {formatTime(a.time)}
                        </div>
                        <StatusChip status={a.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Tiny quick shortcuts */}
      <div className="card p-4 space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">
          Quick shortcuts
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <ChipLink href="/dashboard/appointments/assistant">
            View appointments
          </ChipLink>
          <ChipLink href="/dashboard/shop-orders">
            Manage shop orders
          </ChipLink>
          <ChipLink href="/dashboard/products">Adjust inventory</ChipLink>
          <ChipLink href="/dashboard/suppliers">Review supplier POs</ChipLink>
        </div>
      </div>
    </div>
  );
}

/* --- tiny building blocks -------------------------------------------------- */

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

function StackedStatusBar({ buckets }: { buckets: StatusBucket }) {
  const total =
    buckets.pending +
      buckets.confirmed +
      buckets.checkedIn +
      buckets.done +
      buckets.cancelled || 0;

  if (!total) {
    return <div className="h-3 rounded-full bg-slate-100" />;
  }

  const pct = (n: number) => `${(n / total) * 100}%`;

  return (
    <div className="h-3 rounded-full bg-slate-100 overflow-hidden flex">
      {buckets.pending > 0 && (
        <div
          className="h-3"
          style={{ width: pct(buckets.pending), background: "#e5e7eb" }}
        />
      )}
      {buckets.confirmed > 0 && (
        <div
          className="h-3"
          style={{ width: pct(buckets.confirmed), background: "#dbeafe" }}
        />
      )}
      {buckets.checkedIn > 0 && (
        <div
          className="h-3"
          style={{ width: pct(buckets.checkedIn), background: "#fef3c7" }}
        />
      )}
      {buckets.done > 0 && (
        <div
          className="h-3"
          style={{ width: pct(buckets.done), background: "#dcfce7" }}
        />
      )}
      {buckets.cancelled > 0 && (
        <div
          className="h-3"
          style={{ width: pct(buckets.cancelled), background: "#fee2e2" }}
        />
      )}
    </div>
  );
}

function StatusLegend({
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
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      <span>
        {label} ({value})
      </span>
    </span>
  );
}

function StatusChip({ status }: { status: string }) {
  const v = status.toLowerCase();
  let bg = "#e5e7eb";
  let fg = "#374151";
  if (v === "confirmed") {
    bg = "#dbeafe";
    fg = "#1d4ed8";
  } else if (v === "checked-in") {
    bg = "#fef3c7";
    fg = "#92400e";
  } else if (v === "done" || v === "completed") {
    bg = "#dcfce7";
    fg = "#166534";
  } else if (v === "cancelled") {
    bg = "#fee2e2";
    fg = "#b91c1c";
  }

  return (
    <span
      className="px-2 py-0.5 rounded-full text-[11px]"
      style={{ background: bg, color: fg }}
    >
      {prettyStatus(status)}
    </span>
  );
}

/* subtle links & chips */

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

function SubtlePrimaryLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-lg px-3 py-1.5 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-[var(--primary)] hover:text-white transition"
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

/* --- helpers --------------------------------------------------------------- */

function firstName(full: string): string {
  const parts = full.trim().split(/\s+/);
  return parts[0] || full;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function prettyStatus(s: string): string {
  const v = s.toLowerCase();
  if (v === "checked-in") return "Checked-in";
  if (v === "pending") return "Pending";
  if (v === "confirmed") return "Confirmed";
  if (v === "done" || v === "completed") return "Completed";
  if (v === "cancelled") return "Cancelled";
  return s;
}
