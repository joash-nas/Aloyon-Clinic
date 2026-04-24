/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type PatientSummary = {
  ordersCount: number;
  pendingOrders: number;
  lastOrder: { createdAt: string; total: number } | null;
  upcomingAppointmentsCount: number;
  lastCheckupDate: string | null;
  nextCheckupDate: string | null;
};

export default function PatientOverview({ user }: { user: any }) {
  const [summary, setSummary] = useState<PatientSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // -------------------- Load patient summary --------------------
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);

      try {
        const res = await fetch("/api/me/summary", { cache: "no-store" });

        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `Failed to load summary (${res.status})`);
        }

        const data = (await res.json()) as PatientSummary;

        if (!cancelled) {
          setSummary(data);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "Failed to load summary");
          setSummary(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const lastCheck = summary?.lastCheckupDate
    ? new Date(summary.lastCheckupDate)
    : null;

  const nextCheck = summary?.nextCheckupDate
    ? new Date(summary.nextCheckupDate)
    : null;

  const { label: nextCheckLabel, status: nextCheckStatus } =
    describeNextCheck(nextCheck);

  const lastOrderDate =
    summary?.lastOrder?.createdAt && new Date(summary.lastOrder.createdAt);

  const displayName = user?.full_name || user?.name || user?.email || "there";

  // 6-month wellness cycle: 0–100% based on days since last checkup
  const wellnessProgress = computeWellnessProgress(lastCheck);

  // Order completion vs pending
  const totalOrders = summary?.ordersCount ?? 0;
  const pendingOrders = summary?.pendingOrders ?? 0;
  const completedOrders = Math.max(0, totalOrders - pendingOrders);
  const ordersProgress =
    totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">
          Hello patient, {firstName(displayName)} 👋
        </h1>
        <p className="text-sm text-muted">
          A light overview of your check-ups, appointments, and shop orders.
        </p>
      </div>

      {err && (
        <div className="rounded-2xl bg-red-50 text-red-800 text-sm px-4 py-3">
          {err}
        </div>
      )}

      {/* Top row – shop orders + next check-up */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Shop orders */}
        <div className="card p-5 space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">
              Shop orders
            </div>
          </div>

          {loading && !summary ? (
            <div className="text-sm text-muted">Loading orders…</div>
          ) : (
            <>
              <div className="flex flex-wrap items-baseline gap-3">
                <div>
                  <div className="text-3xl font-semibold">{totalOrders}</div>
                  <div className="text-xs text-muted">total orders</div>
                </div>

                <div className="text-xs text-muted">
                  Pending / in-progress: <strong>{pendingOrders}</strong>
                </div>

                {summary?.lastOrder && lastOrderDate && (
                  <div className="text-xs text-muted">
                    Last order: {formatDate(lastOrderDate)} • ₱
                    {summary.lastOrder.total.toLocaleString("en-PH")}
                  </div>
                )}
              </div>

              {totalOrders > 0 && (
                <div className="mt-3 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-muted">
                    <span>Completed vs pending</span>
                    <span>{ordersProgress}% completed</span>
                  </div>
                  <ProgressBar value={ordersProgress} tone="ok" />
                </div>
              )}

              <div className="pt-3 flex flex-wrap gap-2 text-xs">
                <SubtleLink href="/dashboard/shop-orders">
                  View my orders
                </SubtleLink>
                <SubtleLink href="/shop">Go to shop</SubtleLink>
              </div>
            </>
          )}
        </div>

        {/* Next check-up */}
        <div className="card p-5 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">
            Next check-up
          </div>

          {loading && !summary && (
            <div className="text-sm text-muted">Loading check-up info…</div>
          )}

          {!loading && !lastCheck && (
            <div className="space-y-2">
              <div className="text-base font-semibold">
                No past check-up on record
              </div>
              <p className="text-xs text-muted">
                We recommend a full eye check-up every <strong>6 months</strong>{" "}
                to keep your vision healthy.
              </p>
              <SubtlePrimaryLink href="/dashboard/appointments" className="mt-2">
                Book first eye exam
              </SubtlePrimaryLink>
            </div>
          )}

          {!loading && lastCheck && (
            <div className="space-y-3">
              <div className="text-sm">
                Last check-up: <strong>{formatDate(lastCheck)}</strong>
              </div>

              {nextCheck && (
                <div className="text-sm">
                  Recommended next: <strong>{formatMonthYear(nextCheck)}</strong>
                </div>
              )}

              {nextCheckLabel && (
                <div
                  className={[
                    "inline-flex mt-1 px-2 py-0.5 rounded-full text-[11px] font-medium",
                    nextCheckStatus === "overdue"
                      ? "bg-red-50 text-red-700"
                      : nextCheckStatus === "soon"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-emerald-50 text-emerald-700",
                  ].join(" ")}
                >
                  {nextCheckLabel}
                </div>
              )}

              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between text-[11px] text-muted">
                  <span>6-month wellness cycle</span>
                  <span>{wellnessProgress}%</span>
                </div>
                <ProgressBar
                  value={wellnessProgress}
                  tone={
                    nextCheckStatus === "overdue"
                      ? "danger"
                      : nextCheckStatus === "soon"
                      ? "warn"
                      : "ok"
                  }
                />
              </div>

              <div className="pt-2">
                <SubtleLink href="/dashboard/appointments">
                  Schedule follow-up
                </SubtleLink>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Second row – appointments + quick actions */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Appointments */}
        <div className="card p-5 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">
            Appointments
          </div>

          {loading && !summary ? (
            <div className="text-sm text-muted">Loading…</div>
          ) : (
            <>
              <div className="text-3xl font-semibold">
                {summary?.upcomingAppointmentsCount ?? 0}
              </div>

              <div className="text-xs text-muted">
                upcoming appointment
                {(summary?.upcomingAppointmentsCount ?? 0) === 1 ? "" : "s"}
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <SubtlePrimaryLink href="/dashboard/appointments">
                  View my appointments
                </SubtlePrimaryLink>
              </div>
            </>
          )}
        </div>

        {/* Quick actions */}
        <div className="card p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
            Quick actions
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <ChipLink href="/dashboard/appointments">Book eye exam</ChipLink>
            <ChipLink href="/dashboard/appointments">
              View my appointments
            </ChipLink>
            <ChipLink href="/shop">Shop frames &amp; eyedrops</ChipLink>
            <ChipLink href="/dashboard/shop-orders">Track shop orders</ChipLink>
            <ChipLink href="/dashboard/prescriptions">
              View prescriptions
            </ChipLink>
            <ChipLink href="/dashboard/profile">Update my profile</ChipLink>
          </div>
        </div>
      </div>
    </div>
  );
}

/* --- subtle link helpers -------------------------------------------------- */

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
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={[
        "inline-flex items-center rounded-lg px-3 py-1.5 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-[var(--primary)] hover:text-white transition",
        className,
      ].join(" ")}
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

/* --- tiny reusable progress bar ------------------------------------------ */

function ProgressBar({
  value,
  tone = "ok",
}: {
  value: number;
  tone?: "ok" | "warn" | "danger";
}) {
  const safe = Math.max(0, Math.min(100, value));

  const base = "h-2 rounded-full transition-all duration-300";

  const color =
    tone === "danger"
      ? "bg-red-500"
      : tone === "warn"
      ? "bg-amber-500"
      : "bg-emerald-500";

  return (
    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
      <div className={`${base} ${color}`} style={{ width: `${safe}%` }} />
    </div>
  );
}

/* --- helpers -------------------------------------------------------------- */

function firstName(full: string): string {
  const parts = full.trim().split(/\s+/);
  return parts[0] || full;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function formatMonthYear(d: Date): string {
  return d.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
  });
}

/**
 * Describe how far the next check-up is.
 */
function describeNextCheck(
  nextCheck: Date | null
): { label: string | null; status: "overdue" | "soon" | "ok" | null } {
  if (!nextCheck) return { label: null, status: null };

  const now = new Date();
  const diffMs = nextCheck.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      label: `Overdue by ${Math.abs(diffDays)} day${
        Math.abs(diffDays) === 1 ? "" : "s"
      }`,
      status: "overdue",
    };
  }

  if (diffDays === 0) {
    return { label: "Due today", status: "soon" };
  }

  if (diffDays <= 30) {
    return {
      label: `Due in ${diffDays} day${diffDays === 1 ? "" : "s"}`,
      status: "soon",
    };
  }

  return { label: `Due in ${diffDays} days`, status: "ok" };
}

/**
 * 6-month wellness cycle progress: 0–100 based on days since last check-up.
 */
function computeWellnessProgress(lastCheck: Date | null): number {
  if (!lastCheck) return 0;

  const now = new Date();
  const diffMs = now.getTime() - lastCheck.getTime();
  const diffDays = Math.max(0, diffMs / (1000 * 60 * 60 * 24));
  const pct = (diffDays / 180) * 100;

  return Math.round(Math.max(0, Math.min(100, pct)));
}