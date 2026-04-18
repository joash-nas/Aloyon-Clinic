// src/components/dashboard/AdminOverview.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type UsersByRole = {
  admin: number;
  doctor: number;
  assistant: number;
  sales: number;
  supplier: number;
  patient: number;
};

type AdminSummary = {
  usersTotal: number;
  usersByRole: UsersByRole;
};

export default function AdminOverview({ user }: { user: any }) {
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch("/api/admin/summary", { cache: "no-store" });
        const j = await res.json();
        if (!res.ok) throw new Error(j?.error || `Failed (${res.status})`);
        if (!cancelled) setSummary(j as AdminSummary);
      } catch (e: any) {
        if (!cancelled) {
          setErr(e.message || "Failed to load admin overview");
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

  const usersTotal = summary?.usersTotal ?? 0;
  const byRole: UsersByRole =
    summary?.usersByRole ?? {
      admin: 0,
      doctor: 0,
      assistant: 0,
      sales: 0,
      supplier: 0,
      patient: 0,
    };

  const staffTotal =
    byRole.admin + byRole.doctor + byRole.assistant + byRole.sales + byRole.supplier;

  const displayName =
    user?.full_name || user?.name || user?.email || "Admin";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">
          Hello admin, {firstName(displayName)} 👋
        </h1>
        <p className="text-sm text-muted">
          Overview of users, access, and system status.
        </p>
      </div>

      {err && (
        <div className="rounded-2xl bg-red-50 text-red-800 text-sm px-4 py-3">
          {err}
        </div>
      )}

      {/* Top stats row: users only */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total users"
          value={usersTotal}
          detail="All staff and patients in the system"
        />
        <StatCard
          label="Staff accounts"
          value={staffTotal}
          detail="Admins, doctors, assistants, sales, suppliers"
        />
        <StatCard
          label="Doctors"
          value={byRole.doctor}
          detail="Users with DOCTOR role"
        />
        <StatCard
          label="Patients"
          value={byRole.patient}
          detail="Active patient accounts"
        />
      </div>

      {/* Middle: user breakdown + security */}
      <div className="grid gap-4 lg:grid-cols-[2fr_1.4fr]">
        {/* User breakdown */}
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">
              Users by role
            </div>
            <SubtleLink href="/dashboard/users">Open user management</SubtleLink>
          </div>

          {loading && !summary ? (
            <p className="text-sm text-muted">Loading users…</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <RoleRow label="Admins" value={byRole.admin} />
              <RoleRow label="Doctors" value={byRole.doctor} />
              <RoleRow label="Assistants" value={byRole.assistant} />
              <RoleRow label="Sales" value={byRole.sales} />
              <RoleRow label="Suppliers" value={byRole.supplier} />
              <RoleRow label="Patients" value={byRole.patient} />
            </div>
          )}

          <p className="text-[11px] text-muted mt-2">
            Use this to keep track of how many sensitive roles exist and review
            if access is appropriate.
          </p>
        </div>

        {/* Security / audit card */}
        {/* <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">
              Security &amp; audit logs
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              Coming soon
            </span>
          </div>

          <p className="text-xs text-muted">
            This area will show sign-in activity, password reset events, and
            sensitive actions (like deleting users or changing roles).
          </p>

          <ul className="list-disc list-inside text-[11px] text-muted space-y-1">
            <li>Track who logged in and when</li>
            <li>See changes to roles and permissions</li>
            <li>Review security-related events for investigations</li>
          </ul>

          <button
            className="btn btn-ghost btn-sm text-xs opacity-60 mt-2"
            disabled
          >
            View audit logs (coming soon)
          </button>
        </div> */}
      </div>

      {/* Bottom: system status + shortcuts */}
      <div className="grid gap-4 lg:grid-cols-[2fr_1.4fr]">
        {/* System status */}
        <div className="card p-5 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">
            System status
          </div>

          <div className="mt-2 space-y-2 text-sm">
            <StatusRow label="Web app / Next.js" status="OK" />
            <StatusRow label="MongoDB connection" status="OK" />
            <StatusRow label="Background jobs / queues" status="OK" />
          </div>

        </div>

        {/* Quick admin shortcuts */}
        <div className="card p-5 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">
            Quick shortcuts
          </div>
          <p className="text-xs text-muted">
            
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            <ChipLink href="/dashboard/users">Manage users &amp; roles</ChipLink>
            <ChipLink href="/dashboard/security">Security logs</ChipLink>
          </div>
        </div>
      </div>
    </div>
  );
}

/* --- small building blocks ------------------------------------------------- */

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="card p-4 space-y-1">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </div>
      <div className="text-2xl font-semibold text-slate-800">{value}</div>
      <div className="text-[11px] text-muted">{detail}</div>
    </div>
  );
}

function RoleRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span>{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function StatusRow({ label, status }: { label: string; status: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span>{label}</span>
      <span className="inline-flex items-center gap-1 text-xs">
        <span className="w-2 h-2 rounded-full bg-emerald-500" />
        {status}
      </span>
    </div>
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

/* helpers */

function firstName(full: string): string {
  const parts = full.trim().split(/\s+/);
  return parts[0] || full;
}
