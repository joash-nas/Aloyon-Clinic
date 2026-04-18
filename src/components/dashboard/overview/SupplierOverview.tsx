// src/components/dashboard/SupplierOverview.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type RecentOrder = {
  id: string;
  poNumber: string;
  createdAt: string; // ISO
  status: string;
  total: number;
};

type SupplierSummary = {
  totalOpen: number;
  pending: number;
  processing: number;
  shipped: number;
  deliveredLast30Days: number;
  recentOrders: RecentOrder[];
};

export default function SupplierOverview({ user }: { user: any }) {
  const [summary, setSummary] = useState<SupplierSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch("/api/supplier/summary", { cache: "no-store" });
        const j = await res.json();
        if (!res.ok) {
          throw new Error(j?.error || `Failed to load (${res.status})`);
        }
        if (!cancelled) setSummary(j as SupplierSummary);
      } catch (e: any) {
        if (!cancelled) {
          setErr(e.message || "Failed to load supplier overview");
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

  const totalOpen = summary?.totalOpen ?? 0;
  const pending = summary?.pending ?? 0;
  const processing = summary?.processing ?? 0;
  const shipped = summary?.shipped ?? 0;
  const deliveredLast30Days = summary?.deliveredLast30Days ?? 0;
  const recentOrders = summary?.recentOrders ?? [];

  const displayName =
    user?.full_name || user?.name || user?.email || "Supplier";

  const totalForBar = pending + processing + shipped || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">
          Hello supplier, {firstName(displayName)} 📦
        </h1>
        <p className="text-sm text-muted">
          Overview of incoming orders from the clinic and their current status.
        </p>
      </div>

      {err && (
        <div className="rounded-2xl bg-red-50 text-red-800 text-sm px-4 py-3">
          {err}
        </div>
      )}

      {/* Top stats row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Open purchase orders"
          value={totalOpen}
          detail="Pending, processing, or shipped"
          highlightTone={totalOpen > 0 ? "warn" : "muted"}
        />
        <StatCard
          label="Pending"
          value={pending}
          detail="Waiting to be processed"
        />
        <StatCard
          label="Processing"
          value={processing}
          detail="Being prepared by your team"
        />
        <StatCard
          label="Shipped"
          value={shipped}
          detail="On the way to the clinic"
          highlightTone={shipped > 0 ? "ok" : "muted"}
        />
      </div>

      {/* Middle row: open status mix + delivered */}
      <div className="grid gap-4 lg:grid-cols-[2fr_1.4fr]">
        {/* Open orders status mix */}
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">
              Open orders by status
            </div>
            <SubtleLink href="/dashboard/purchase-orders">
              View all POs
            </SubtleLink>
          </div>

          {loading && !summary ? (
            <p className="text-sm text-muted">Loading open orders…</p>
          ) : totalForBar === 0 ? (
            <p className="text-sm text-muted">
              You don&apos;t have any open purchase orders right now.
            </p>
          ) : (
            <>
              <OpenOrdersBar
                pending={pending}
                processing={processing}
                shipped={shipped}
              />
              <div className="flex flex-wrap gap-4 text-[11px] text-muted mt-2">
                <LegendDot color="#e5e7eb" label="Pending" value={pending} />
                <LegendDot color="#fef3c7" label="Processing" value={processing} />
                <LegendDot color="#bfdbfe" label="Shipped" value={shipped} />
              </div>
            </>
          )}
        </div>

        {/* Delivered last 30 days */}
        <div className="card p-5 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">
            Delivered in the last 30 days
          </div>

          {loading && !summary ? (
            <p className="text-sm text-muted">Loading delivery stats…</p>
          ) : (
            <>
              <div className="text-3xl font-semibold">{deliveredLast30Days}</div>
              <div className="text-[11px] text-muted">
                Purchase orders marked as <span className="font-medium">Delivered</span> in the last 30 days.
              </div>

              {deliveredLast30Days > 0 && (
                <div className="mt-4 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-muted">
                    <span>Delivery activity</span>
                    <span>{deliveredLast30Days} PO{deliveredLast30Days === 1 ? "" : "s"}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-2 rounded-full bg-emerald-500"
                      style={{
                        width: `${Math.min(100, deliveredLast30Days * 5)}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Bottom row: recent orders table */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">
            Recent purchase orders
          </div>
          <SubtleLink href="/dashboard/purchase-orders">
            Open full PO list
          </SubtleLink>
        </div>

        {loading && !summary ? (
          <p className="text-sm text-muted">Loading recent POs…</p>
        ) : recentOrders.length === 0 ? (
          <p className="text-sm text-muted">
            No purchase orders found for your account yet.
          </p>
        ) : (
          <div className="overflow-x-auto -mx-3">
            <table className="w-full text-xs md:text-sm">
              <thead className="bg-[var(--muted)]/60">
                <tr>
                  <th className="text-left px-3 py-2">PO number</th>
                  <th className="text-left px-3 py-2">Created</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-right px-3 py-2">Total</th>
                  <th className="text-right px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => (
                  <tr key={o.id} className="border-t border-[var(--border)]">
                    <td className="px-3 py-2 font-medium">
                      {o.poNumber}
                    </td>
                    <td className="px-3 py-2 text-muted">
                      {formatDate(o.createdAt)}
                    </td>
                    <td className="px-3 py-2">
                      <StatusChip status={o.status} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      ₱{o.total.toLocaleString("en-PH", {
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/dashboard/purchase-orders/${o.id}`}
                        className="inline-flex items-center rounded-lg px-2 py-1 text-[11px] md:text-xs ring-1 ring-[var(--border)] hover:bg-neutral-50"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* --- building blocks ------------------------------------------------------ */

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

function OpenOrdersBar({
  pending,
  processing,
  shipped,
}: {
  pending: number;
  processing: number;
  shipped: number;
}) {
  const total = pending + processing + shipped || 0;
  if (!total) {
    return <div className="h-3 rounded-full bg-slate-100" />;
  }

  const pct = (n: number) => `${(n / total) * 100}%`;

  return (
    <div className="h-3 rounded-full bg-slate-100 overflow-hidden flex">
      {pending > 0 && (
        <div
          className="h-3"
          style={{ width: pct(pending), background: "#e5e7eb" }}
        />
      )}
      {processing > 0 && (
        <div
          className="h-3"
          style={{ width: pct(processing), background: "#fef3c7" }}
        />
      )}
      {shipped > 0 && (
        <div
          className="h-3"
          style={{ width: pct(shipped), background: "#bfdbfe" }}
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

function StatusChip({ status }: { status: string }) {
  const v = (status || "").toLowerCase();
  let bg = "#e5e7eb";
  let fg = "#374151";
  if (v === "pending") {
    bg = "#e5e7eb";
    fg = "#374151";
  } else if (v === "processing" || v === "in progress") {
    bg = "#fef3c7";
    fg = "#92400e";
  } else if (v === "shipped") {
    bg = "#bfdbfe";
    fg = "#1d4ed8";
  } else if (v === "delivered") {
    bg = "#dcfce7";
    fg = "#166534";
  } else if (v === "cancelled" || v === "canceled") {
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

function prettyStatus(s: string): string {
  const v = (s || "").toLowerCase();
  if (v === "pending") return "Pending";
  if (v === "processing" || v === "in progress") return "Processing";
  if (v === "shipped") return "Shipped";
  if (v === "delivered") return "Delivered";
  if (v === "cancelled" || v === "canceled") return "Cancelled";
  return s;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
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
