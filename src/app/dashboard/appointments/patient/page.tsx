/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/dashboard/appointments/patient/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Calendar from "@/components/appointments/Calendar";

type Slot = { time: string; available: boolean };
type Upcoming = {
  _id: string;
  day: string;
  time: string;
  notes?: string | null;
};

function toYmd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

export default function PatientAppointmentsPage() {
  const [day, setDay] = useState<string>(toYmd(new Date()));
  const [time, setTime] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [upcoming, setUpcoming] = useState<Upcoming[]>([]);

  async function loadAvailability(d: string) {
    setLoadingSlots(true);
    setErr(null);
    try {
      const q = new URLSearchParams({ day: d });
      const res = await fetch(`/api/appointments/availability?${q.toString()}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || `Failed (${res.status})`);
      setSlots(j.slots || []);
      if (
        time &&
        !(j.slots || []).some((s: Slot) => s.time === time && s.available)
      ) {
        setTime("");
      }
    } catch (e: any) {
      setErr(e.message || "Failed to load availability");
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }

  async function loadUpcoming() {
    try {
      const res = await fetch("/api/appointments", { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) return;
      setUpcoming(j.items || []);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    loadAvailability(day);
  }, [day]);

  useEffect(() => {
    loadUpcoming();
  }, []);

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

  async function book() {
    if (!day || !time) {
      setErr("Please select a date and time.");
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day, time, notes: notes.trim() || undefined }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Booking failed");

      setNotes("");
      setTime("");
      await Promise.all([loadAvailability(day), loadUpcoming()]);
    } catch (e: any) {
      setErr(e.message || "Failed to book appointment");
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: string) {
    try {
      const res = await fetch(`/api/appointments/${id}`, { method: "PATCH" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(j?.error || `Cancel failed (${res.status})`);
      await Promise.all([loadAvailability(day), loadUpcoming()]);
    } catch (e: any) {
      setErr(e.message || "Cancel failed");
    }
  }

  return (
    <div className="grid grid-cols-12 gap-8">
      {/* Calendar */}
      <div className="col-span-12 lg:col-span-5">
        <div className="card p-5 rounded-2xl ring-1 ring-[var(--border)] bg-white/70">
          <h2 className="text-lg font-semibold mb-3">Book an Appointment</h2>
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

      {/* Details + Upcoming */}
      <div className="col-span-12 lg:col-span-7">
        <div className="card p-5 rounded-2xl ring-1 ring-[var(--border)] bg-white/70 space-y-5">
          <section>
            <h3 className="text-base font-medium mb-4">
              Appointment Details
            </h3>

            <div className="text-sm text-neutral-600 mb-1">Selected Date</div>
            <div className="font-medium mb-3">{day}</div>

            <label className="text-sm text-neutral-600">Time Slot</label>
            <select
              className="mt-1 w-full rounded-xl border px-3 py-2"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              disabled={loadingSlots}
            >
              <option value="">Choose a time</option>
              {displaySlots.map((s) => (
                <option key={s.time} value={s.time} disabled={!s.available}>
                  {s.time} {!s.available ? "— Booked" : ""}
                </option>
              ))}
            </select>

            <label className="mt-4 block text-sm text-neutral-600">
              Notes (optional)
            </label>
            <textarea
              className="mt-1 w-full rounded-xl border px-3 py-2"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything the doctor should know…"
            />

            {err && <div className="mt-3 text-sm text-rose-600">{err}</div>}

            <button
              onClick={book}
              disabled={busy || !day || !time}
              className="mt-4 w-full rounded-xl bg-indigo-500 text-white py-2 disabled:opacity-50"
            >
              {busy ? "Booking…" : "Book Appointment"}
            </button>
          </section>

          <section>
            <h3 className="text-base font-medium mb-2">
              Your Appointments
            </h3>
            {upcoming.length === 0 ? (
              <div className="text-sm opacity-70">
                No upcoming appointments.
              </div>
            ) : (
              <ul className="space-y-2">
                {upcoming.map((a) => (
                  <li
                    key={a._id}
                    className="flex items-center justify-between rounded-xl border px-3 py-2"
                  >
                    <div>
                      <div className="font-medium">
                        {a.day} — {a.time}
                      </div>
                      {a.notes ? (
                        <div className="text-sm opacity-80">
                          “{a.notes}”
                        </div>
                      ) : null}
                    </div>
                    <button
                      className="text-sm px-3 py-1 rounded-md border hover:bg-gray-50"
                      onClick={() => cancel(a._id)}
                    >
                      Cancel
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
