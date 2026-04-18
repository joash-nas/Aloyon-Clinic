/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/dashboard/appointments/doctor/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type Row = {
  _id: string;
  day: string; // "YYYY-MM-DD"
  time: string; // "HH:mm"
  notes?: string | null;
  status?: "booked" | "done" | "cancelled" | string;

  patientName?: string | null;
  patientEmail?: string | null;

  patientFullName?: string | null;
};

function toDateTime(day: string, time: string) {
  const safeDay = day || "1970-01-01";
  const safeTime = time || "00:00";
  return new Date(`${safeDay}T${safeTime}:00`);
}

function formatDayLabel(ymd: string) {
  try {
    const d = new Date(`${ymd}T00:00:00`);
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(d);
  } catch {
    return ymd;
  }
}

function statusClasses(status?: string) {
  const s = (status || "booked").toLowerCase();
  if (s === "done") return "bg-indigo-50 text-indigo-700";
  if (s === "cancelled") return "bg-rose-50 text-rose-700";
  return "bg-emerald-100 text-emerald-700";
}

function formatStatusLabel(status?: string) {
  const s = (status || "booked").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function DoctorAppointmentsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(
        "/api/appointments?view=doctor&scope=upcoming&page=1&limit=50",
        { cache: "no-store" }
      );
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || `Failed (${res.status})`);

      const items = (j.items || []) as Row[];
      const now = new Date();

      const upcoming = items.filter((r) => {
        try {
          const when = toDateTime(r.day, r.time);
          return when.getTime() >= now.getTime();
        } catch {
          return true;
        }
      });

      upcoming.sort((a, b) => {
        const da = toDateTime(a.day, a.time).getTime();
        const db = toDateTime(b.day, b.time).getTime();
        return da - db;
      });

      setRows(upcoming);
    } catch (e: any) {
      setErr(e.message || "Failed to load");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function markDone(id: string) {
    const res = await fetch(`/api/appointments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "done" }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j?.error || `Failed (${res.status})`);
      return;
    }
    setRows((r) => r.filter((x) => x._id !== id));
  }

  async function cancel(id: string) {
    const res = await fetch(`/api/appointments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j?.error || `Failed (${res.status})`);
      return;
    }
    setRows((r) => r.filter((x) => x._id !== id));
  }

  const grouped = useMemo(() => {
    return rows.reduce<Record<string, Row[]>>((acc, r) => {
      (acc[r.day] ||= []).push(r);
      return acc;
    }, {});
  }, [rows]);

  const stats = useMemo(() => {
    if (!rows.length) return null;
    const first = rows[0];
    const nextLabel = `${first.day} • ${first.time}`;
    return {
      total: rows.length,
      nextLabel,
    };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Upcoming Appointments
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            View and manage your upcoming patient visits. Past appointments are
            automatically hidden.
          </p>
        </div>
        <button
          className="px-4 py-2 rounded-xl bg-white ring-1 ring-[var(--border)] shadow-sm text-sm hover:bg-black/5 disabled:opacity-50"
          onClick={load}
          disabled={busy}
        >
          {busy ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white/80 ring-1 ring-[var(--border)] p-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-neutral-500">
              Total upcoming
            </div>
            <div className="mt-1 text-xl font-semibold">
              {rows.length || 0}
            </div>
          </div>
          <div className="text-xs px-3 py-1 rounded-full bg-indigo-50 text-indigo-700">
            Includes today and future dates
          </div>
        </div>

        <div className="rounded-2xl bg-white/80 ring-1 ring-[var(--border)] p-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-neutral-500">
              Next appointment
            </div>
            <div className="mt-1 text-sm font-medium">
              {stats ? stats.nextLabel : "No upcoming visits"}
            </div>
          </div>
          <div className="text-xs px-3 py-1 rounded-full bg-emerald-50 text-emerald-700">
            Auto-sorted by soonest
          </div>
        </div>
      </div>

      {err && (
        <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
          {err}
        </div>
      )}

      {Object.keys(grouped).length === 0 && !busy && !err && (
        <div className="mt-4 rounded-2xl bg-white/80 ring-1 ring-[var(--border)] p-6 text-center text-sm text-neutral-500">
          <div className="text-base font-medium mb-1">
            No upcoming appointments
          </div>
          <div>
            Once patients start booking, they’ll appear here with actions to
            mark them as done or cancel.
          </div>
        </div>
      )}

      {busy && rows.length === 0 && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-2xl bg-white/70 ring-1 ring-[var(--border)] p-4 space-y-2"
            >
              <div className="h-4 w-32 bg-neutral-200 rounded" />
              <div className="h-3 w-full bg-neutral-200 rounded" />
              <div className="h-3 w-2/3 bg-neutral-200 rounded" />
            </div>
          ))}
        </div>
      )}

      <div className="space-y-4">
        {Object.entries(grouped).map(([day, list]) => (
          <section
            key={day}
            className="rounded-2xl bg-white/80 ring-1 ring-[var(--border)] shadow-sm overflow-hidden"
          >
            <header className="flex items-center justify-between px-5 py-3 bg-[var(--muted)]/70">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold">
                  {formatDayLabel(day)}
                </span>
                <span className="text-xs text-neutral-500">
                  {list.length}{" "}
                  {list.length === 1 ? "appointment" : "appointments"}
                </span>
              </div>
            </header>

            <div className="divide-y divide-[var(--border)]">
              {list.map((r) => (
                <div
                  key={r._id}
                  className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="min-w-[72px]">
                      <div className="text-sm font-semibold">{r.time}</div>
                      <div className="text-xs text-neutral-500">Time</div>
                    </div>

                    <div className="flex-1">
                      <div className="text-sm font-medium">
                        {r.patientFullName ||
                          r.patientName ||
                          r.patientEmail ||
                          "—"}
                      </div>
                      {r.patientEmail && (
                        <div className="text-xs text-neutral-500">
                          {r.patientEmail}
                        </div>
                      )}
                      {r.notes && (
                        <div className="mt-1 text-xs text-neutral-700 line-clamp-2">
                          {r.notes}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-3">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusClasses(
                        r.status
                      )}`}
                    >
                      {formatStatusLabel(r.status)}
                    </span>

                    <div className="flex gap-2">
                      <button
                        className="text-xs sm:text-sm px-3 py-1.5 rounded-md bg-indigo-100 text-indigo-800 hover:bg-indigo-200 transition"
                        onClick={() => markDone(r._id)}
                      >
                        Done
                      </button>
                      <button
                        className="text-xs sm:text-sm px-3 py-1.5 rounded-md bg-rose-100 text-rose-800 hover:bg-rose-200 transition"
                        onClick={() => cancel(r._id)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}