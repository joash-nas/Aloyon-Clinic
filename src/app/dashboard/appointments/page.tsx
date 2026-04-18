/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/dashboard/appointments/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Calendar from "@/components/appointments/Calendar";
import PatientAppointmentList from "@/components/appointments/PatientAppointmentList";

type Slot = { time: string; available: boolean };
type Scope = "upcoming" | "past" | "all";
type ListItem = {
  _id: string;
  day: string;
  time: string;
  date?: string;
  status?: "booked" | "cancelled" | string;
  notes?: string | null;
  createdAt?: string;

  // UI-only
  statusLabel?: string;
};

function toYmd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

function prettyStatus(s?: string | null) {
  if (!s) return "";
  const v = String(s).trim();
  if (!v) return "";
  return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
}

export default function AppointmentsPage() {
  // Booking state
  const [day, setDay] = useState<string>(toYmd(new Date()));
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Mobile-only calendar collapse
  const [calendarOpen, setCalendarOpen] = useState(true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isMobile = window.matchMedia("(max-width: 639px)").matches; // tailwind sm
    setCalendarOpen(!isMobile); // collapsed on mobile, open on desktop
  }, []);

  // List state
  const [scope, setScope] = useState<Scope>("upcoming");
  const [items, setItems] = useState<ListItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  // Search + pagination
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(5);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState<number | undefined>(undefined);

  // =========================
  // Availability
  // =========================
  async function loadAvailability(ymd: string) {
    setLoadingSlots(true);
    setErr(null);
    try {
      const qs = new URLSearchParams({ day: ymd });
      if (
        process.env.NEXT_PUBLIC_DEFAULT_DOCTOR_ID &&
        process.env.NEXT_PUBLIC_DEFAULT_DOCTOR_ID.length === 24
      ) {
        qs.set("doctorId", process.env.NEXT_PUBLIC_DEFAULT_DOCTOR_ID);
      }
      const res = await fetch(`/api/appointments/availability?${qs.toString()}`, {
        cache: "no-store",
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || `Failed (${res.status})`);
      const options = (j.slots || []) as Slot[];
      setSlots(options);

      if (time && options.some((s) => s.time === time && !s.available)) {
        setTime("");
      }
    } catch (e: any) {
      setErr(e.message || "Failed to load availability");
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }

  useEffect(() => {
    void loadAvailability(day);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  // =========================
  // List loader (tabs + paging + search)
  // =========================
  async function loadList() {
    setLoadingList(true);
    try {
      const qs = new URLSearchParams({
        scope,
        page: String(page),
        limit: String(limit),
      });
      if (q.trim()) qs.set("q", q.trim());

      const res = await fetch(`/api/appointments?${qs.toString()}`, {
        cache: "no-store",
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || `Failed (${res.status})`);

      const nextItems: ListItem[] = (j.items || []).map((it: ListItem) => ({
        ...it,
        statusLabel: prettyStatus(it.status),
      }));

      setItems(nextItems);
      setHasMore(!!j.hasMore);
      setTotal(typeof j.total === "number" ? j.total : undefined);
    } catch (e: any) {
      setErr(e.message || "Failed to load appointments");
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    void loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, page, limit]);

  useEffect(() => {
    const id = setTimeout(() => {
      setPage(1);
      void loadList();
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  
  async function book() {
    if (!day || !time) {
      setErr("Please choose a date and time.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day, time, notes: notes?.trim() || undefined }),
      });
      const j = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 409) {
          await loadAvailability(day);
          setTime("");
          setErr("That time slot was just taken. Please choose another time.");
          return;
        }
        throw new Error(j?.error || `Failed (${res.status})`);
      }

      await Promise.all([loadList(), loadAvailability(day)]);
      setTime("");
      setNotes("");
    } catch (e: any) {
      setErr(e.message || "Booking failed");
    } finally {
      setSaving(false);
    }
  }

  // =========================
  // Cancel
  // =========================
  async function cancel(id: string) {
    try {
      const shouldStepBack = items.length === 1 && page > 1;
      if (shouldStepBack) setPage((p) => p - 1);

      const res = await fetch(`/api/appointments/${id}`, { method: "PATCH" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `Cancel failed (${res.status})`);
      }
      await loadList();
      await loadAvailability(day);
    } catch (e: any) {
      setErr(e.message || "Failed to cancel appointment");
    }
  }

  const displaySlots = useMemo(() => {
    const now = new Date();
    const nowHm = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}`;
    const isToday = day === toYmd(now);
    return slots.map((s) => ({
      time: s.time,
      available: s.available && (!isToday || s.time >= nowHm),
    }));
  }, [slots, day]);

  const canBook = !!day && !!time && !saving;

  const from = (page - 1) * limit + (items.length ? 1 : 0);
  const to = (page - 1) * limit + items.length;

  return (
    <div className="grid grid-cols-12 gap-8">
      {/* Left: Calendar + Booking */}
      <div className="col-span-12 lg:col-span-5">
        <div className="card p-5 rounded-2xl ring-1 ring-[var(--border)] bg-white/70">
          <h2 className="text-lg font-semibold mb-4">Book an Appointment</h2>

          {/* Mobile-only collapse toggle */}
          <div className="sm:hidden mb-3">
            <button
              type="button"
              onClick={() => setCalendarOpen((v) => !v)}
              className="w-full rounded-xl border px-3 py-2 text-sm bg-white hover:bg-gray-50 flex items-center justify-between"
            >
              <span>{calendarOpen ? "Hide calendar" : "Show calendar"}</span>
              <span className="text-xs opacity-60">{day}</span>
            </button>
          </div>

          {/* Calendar (collapsible on phone only) */}
          {(calendarOpen || typeof window === "undefined") && (
            <div className="flex justify-center pt-1">
              <div className="w-full max-w-[320px]">
                <Calendar
                  selectedDay={day}
                  onSelectDate={(d: Date) => {
                    setDay(toYmd(d));
                    setTime("");
                  }}
                  firstDayOfWeek={0}
                />
              </div>
            </div>
          )}

          <div className="mt-5">
            <div className="text-sm text-neutral-600 mb-1">Selected Date</div>
            <div className="font-medium mb-3">{day}</div>

            <label className="text-sm text-neutral-600">
              Time Slot {loadingSlots ? "(checking…)" : ""}
            </label>
            <select
              className="mt-1 w-full rounded-xl border px-3 py-2"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              disabled={loadingSlots || displaySlots.every((s) => !s.available)}
            >
              <option value="">Choose a time</option>
              {displaySlots
                .filter((s) => s.available)
                .map((s) => (
                  <option key={s.time} value={s.time}>
                    {s.time}
                  </option>
                ))}
            </select>

            <label className="mt-4 block text-sm text-neutral-600">
              Notes (optional)
            </label>
            <textarea
              className="mt-1 w-full rounded-xl border px-3 py-2"
              rows={3}
              placeholder="Anything the doctor should know…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />

            {err && <div className="mt-3 text-sm text-rose-600">{err}</div>}

            <button
              className="mt-4 w-full rounded-xl bg-indigo-600 text-white py-2 disabled:opacity-50"
              disabled={!canBook}
              onClick={book}
            >
              {saving ? "Booking…" : "Book Appointment"}
            </button>
          </div>
        </div>
      </div>

      {/* Right: Tabs + Search + Paged List */}
      <div className="col-span-12 lg:col-span-7">
        <div className="card p-5 rounded-2xl ring-1 ring-[var(--border)] bg-white/70">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div className="flex flex-wrap gap-2">
              {(["upcoming", "past", "all"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setScope(s);
                    setPage(1);
                  }}
                  className={[
                    "px-3 py-1 rounded-full text-sm ring-1 transition",
                    scope === s
                      ? "bg-black text-white ring-black"
                      : "bg-white ring-[var(--border)] hover:bg-black/5",
                  ].join(" ")}
                >
                  {s[0].toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>

            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search notes or YYYY-MM-DD"
              className="w-full sm:w-auto sm:flex-1 sm:max-w-[360px] min-w-0 rounded-full border px-3 py-1.5 text-sm"
            />
          </div>

          <PatientAppointmentList
            items={items}
            loading={loadingList}
            onCancel={cancel}
            enableCancel
          />

          <div className="mt-4 flex items-center justify-between text-sm">
            <div className="opacity-70">
              {total !== undefined && total > 0
                ? `Showing ${from}–${to} of ${total}`
                : items.length === 0
                ? "No results"
                : `${items.length} item(s)`}
            </div>
            <div className="flex gap-2">
              <button
                className="px-3 py-1.5 rounded-lg ring-1 ring-[var(--border)] disabled:opacity-50"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loadingList}
              >
                Prev
              </button>
              <button
                className="px-3 py-1.5 rounded-lg ring-1 ring-[var(--border)] disabled:opacity-50"
                onClick={() => setPage((p) => p + 1)}
                disabled={!hasMore || loadingList}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}