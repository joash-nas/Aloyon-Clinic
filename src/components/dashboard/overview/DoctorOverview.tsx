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
  time: string;          // ISO string from /api/doctor/summary
  patientName: string;
  reason: string | null;
  status: string;
};

type DoctorSummary = {
  todayAppointmentsTotal: number;
  todayByStatus: StatusBucket;
  inClinicNow: number;
  completedToday: number;
  cancellationsToday: number;
  nextAppointment: NextAppt | null;
  upcomingToday: NextAppt[];
  // removed patientsThisMonth
  visitsThisMonth: number;
};

export default function DoctorOverview({ user }: { user: any }) {
  const [summary, setSummary] = useState<DoctorSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch("/api/doctor/summary", { cache: "no-store" });
        const j = await res.json();
        if (!res.ok) {
          throw new Error(
            j?.error || `Failed to load doctor summary (${res.status})`
          );
        }
        if (!cancelled) {
          setSummary(j as DoctorSummary);
        }
      } catch (e: any) {
        if (!cancelled) {
          setErr(e.message || "Failed to load doctor overview");
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

  const todayTotal = summary?.todayAppointmentsTotal ?? 0;

  const statusBuckets: StatusBucket = summary?.todayByStatus ?? {
    pending: 0,
    confirmed: 0,
    checkedIn: 0,
    done: 0,
    cancelled: 0,
  };

  const inClinicNow = summary?.inClinicNow ?? statusBuckets.checkedIn ?? 0;
  const doneToday = summary?.completedToday ?? statusBuckets.done ?? 0;
  const cancelledToday =
    summary?.cancellationsToday ?? statusBuckets.cancelled ?? 0;
  const remainingToday = Math.max(
    0,
    todayTotal - doneToday - cancelledToday
  );

  const totalForChart =
    statusBuckets.pending +
      statusBuckets.confirmed +
      statusBuckets.checkedIn +
      statusBuckets.done +
      statusBuckets.cancelled || 0;

  const nextAppt = summary?.nextAppointment ?? null;
  const upcomingShort = (summary?.upcomingToday ?? []).slice(0, 3);

  const visitsThisMonth = summary?.visitsThisMonth ?? 0;

  const displayName =
    user?.full_name || user?.name || user?.email || "Doctor";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">
          Hello doctor, {firstName(displayName)} 👋
        </h1>
        <p className="text-sm text-muted">
          Quick overview of your clinic schedule and patients.
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
          label="Today's appointments"
          value={todayTotal}
          detail="All time slots assigned to you today"
        />
        <StatCard
          label="In clinic now"
          value={inClinicNow}
          highlightTone="warn"
          detail="Checked-in / in progress"
        />
        <StatCard
          label="Completed today"
          value={doneToday}
          highlightTone="ok"
          detail="Marked as done / completed"
        />
        <StatCard
          label="Still to see today"
          value={remainingToday}
          highlightTone="muted"
          detail="Total minus completed & cancelled"
        />
      </div>

      {/* Middle row: schedule chart + next patients */}
      <div className="grid gap-4 lg:grid-cols-[2fr_1.4fr]">
        {/* Schedule chart */}
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">
              Today&apos;s schedule
            </div>
            <SubtleLink href="/dashboard/appointments/doctor">
              Open appointments
            </SubtleLink>
          </div>

          {loading && !summary ? (
            <p className="text-sm text-muted">Loading schedule…</p>
          ) : totalForChart === 0 ? (
            <p className="text-sm text-muted">
              No appointments on your calendar for today.
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

        {/* Next patients card */}
        <div className="card p-5 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">
            Next patients in line
          </div>

          {loading && !summary ? (
            <p className="text-sm text-muted">Finding next appointment…</p>
          ) : !nextAppt ? (
            <p className="text-sm text-muted">
              No upcoming appointment in your queue.
            </p>
          ) : (
            <>
              {/* Main next patient */}
              <div className="rounded-2xl border border-[var(--border)] px-3 py-3 bg-[var(--muted)]/40 space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">
                      {nextAppt.patientName || "Patient"}
                    </div>
                    <div className="text-xs text-muted">
                      {formatTime(nextAppt.time)} •{" "}
                      {prettyStatus(nextAppt.status)}
                    </div>
                  </div>
                  <StatusChip status={nextAppt.status || "booked"} />
                </div>
                {nextAppt.reason && (
                  <p className="text-xs text-muted mt-1 line-clamp-2">
                    {nextAppt.reason}
                  </p>
                )}
              </div>

              {/* Small list of next few patients */}
              {upcomingShort.length > 0 && (
                <div className="space-y-1 text-xs">
                  {upcomingShort.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between py-1 border-b border-[var(--border)]/40 last:border-b-0"
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate max-w-[9rem]">
                          {a.patientName || "Patient"}
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
                        <StatusChip status={a.status || "booked"} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-2">
                <SubtlePrimaryLink href="/dashboard/appointments/doctor">
                  Open full appointments list
                </SubtlePrimaryLink>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom row: month overview + quick shortcuts */}
      <div className="grid gap-4 lg:grid-cols-[2fr_1.2fr]">
        {/* Month overview */}
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">
              This month at a glance
            </div>
          </div>

          {loading && !summary ? (
            <p className="text-sm text-muted">Loading monthly stats…</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-6 text-sm">
                <div>
                  <div className="text-xs text-muted">Patient visits</div>
                  <div className="text-2xl font-semibold">
                    {visitsThisMonth}
                  </div>
                  <div className="text-[11px] text-muted">
                    Completed appointments this month
                  </div>
                </div>
              </div>

              
            </>
          )}
        </div>

        {/* Quick shortcuts */}
        <div className="card p-5 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">
            Quick shortcuts
          </div>
          <p className="text-xs text-muted">
            
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            <ChipLink href="/dashboard/appointments/doctor">
              View today&apos;s appointments
            </ChipLink>
            <ChipLink href="/dashboard/patients">
              Browse patient list
            </ChipLink>
            <ChipLink href="/dashboard/orders">
              Check shop orders
            </ChipLink>
          </div>
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
  const v = normalizeStatus(status);
  let bg = "#e5e7eb";
  let fg = "#374151";
  if (v === "confirmed") {
    bg = "#dbeafe";
    fg = "#1d4ed8";
  } else if (v === "checked-in") {
    bg = "#fef3c7";
    fg = "#92400e";
  } else if (v === "done") {
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
      {prettyStatus(v)}
    </span>
  );
}

/* subtle links & chips */

function SubtleLink({
  href,
  children,
}: {
  href: string;
  children: any;
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
  children: any;
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
  children: any;
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

function normalizeStatus(
  s?: string
): "pending" | "confirmed" | "checked-in" | "done" | "cancelled" {
  const v = (s || "").toLowerCase();
  if (v === "booked") return "pending";
  if (v === "confirmed") return "confirmed";
  if (v === "checked-in") return "checked-in";
  if (v === "done" || v === "completed") return "done";
  if (v === "cancelled" || v === "canceled") return "cancelled";
  return "pending";
}

function prettyStatus(s?: string): string {
  const v = normalizeStatus(s);
  if (v === "checked-in") return "Checked-in";
  if (v === "pending") return "Pending";
  if (v === "confirmed") return "Confirmed";
  if (v === "done") return "Completed";
  if (v === "cancelled") return "Cancelled";
  return s || "";
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
