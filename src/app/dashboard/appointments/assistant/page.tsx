/* eslint-disable @typescript-eslint/no-explicit-any */
/* =============================================================================
   File: src/app/dashboard/appointments/assistant/page.tsx
   Purpose: Assistant-facing booking + list UI 
   ============================================================================ */
"use client";

import { useEffect, useMemo, useState } from "react";
import Calendar from "@/components/appointments/Calendar";

/* ---------- Types ---------- */

type ApptStatus = "booked" | "cancelled" | "done" | string;
type AnyId = string | { $oid: string } | undefined;

type Appt = {
  _id: AnyId;
  day: string;
  time: string;
  patientEmail: string | null;

  patientName?: string | null;
  patientFullName?: string | null;

  status: ApptStatus;
  notes?: string | null;
  date?: string;
  createdAt?: string;
};

type ListResp = {
  items: Appt[];
  total: number;
  page: number;
  pageSize?: number;
  limit?: number;
  hasMore?: boolean;
};

type AvailabilitySlot = { time: string; available: boolean };
type AvailabilityResp = { slots: AvailabilitySlot[] };

type PatientPick = {
  id: string;
  name: string | null;
  email: string | null;
};

type Scope = "upcoming" | "past" | "all";

/* ---------- Utils ---------- */

function toYmd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function idToString(id: AnyId): string {
  if (!id) return "";
  if (typeof id === "string") return id;
  const maybe = (id as any)?.$oid;
  return typeof maybe === "string" ? maybe : "";
}

function statusPillClass(s: string) {
  const v = (s || "").toLowerCase();
  if (v === "booked") return "bg-emerald-100 text-emerald-700";
  if (v === "done") return "bg-indigo-100 text-indigo-700";
  if (v === "cancelled") return "bg-rose-100 text-rose-700";
  return "bg-gray-100 text-gray-700";
}

function formatStatusLabel(s: string) {
  const v = (s || "").toLowerCase();
  if (v === "booked") return "Booked";
  if (v === "cancelled") return "Cancelled";
  if (v === "done") return "Done";
  if (!v) return "—";
  return v.charAt(0).toUpperCase() + v.slice(1);
}

/**
 * Display appointment time in Asia/Manila (clinic time)
 * The `date` field is stored as UTC instant.
 */
function formatDateTime(a: Appt) {
  if (a.date) {
    const d = new Date(a.date);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Manila",
      });
    }
  }

  // fallback: day+time interpreted as Manila time (display-only)
  const d2 = new Date(`${a.day}T${a.time}:00`);
  if (!Number.isNaN(d2.getTime())) {
    return d2.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }

  return `${a.day} — ${a.time}`;
}

/* ---------- Component ---------- */

export default function AssistantAppointmentsPage() {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d;
  }, []);

  const [selectedDay, setSelectedDay] = useState<string>(() => toYmd(today));
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>("");

  const [patientQuery, setPatientQuery] = useState("");
  const debouncedPatientQuery = useDebounced(patientQuery, 250);
  const [patientOptions, setPatientOptions] = useState<PatientPick[]>([]);
  const [patientSearchLoading, setPatientSearchLoading] = useState(false);
  const [patient, setPatient] = useState<PatientPick | null>(null);

  const [notes, setNotes] = useState("");
  const [booking, setBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const [scope, setScope] = useState<Scope>("upcoming");
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [list, setList] = useState<ListResp | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);

  const [calendarOpen, setCalendarOpen] = useState(true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isMobile = window.matchMedia("(max-width: 639px)").matches;
    setCalendarOpen(!isMobile);
  }, []);

  useEffect(() => {
    async function loadSlots() {
      if (!selectedDay) return;
      setSlotsLoading(true);
      setSlotsError(null);
      setSelectedTime("");
      try {
        const res = await fetch(
          `/api/appointments/availability?day=${encodeURIComponent(selectedDay)}`,
          { cache: "no-store" }
        );
        const j: AvailabilityResp = await res.json();
        if (!res.ok) throw new Error((j as any)?.error || `Failed (${res.status})`);
        setSlots(j.slots || []);
      } catch (e: any) {
        setSlots([]);
        setSlotsError(e.message || "Failed to load availability");
      } finally {
        setSlotsLoading(false);
      }
    }
    void loadSlots();
  }, [selectedDay]);

  async function loadList(
    currentScope: Scope = scope,
    currentPage = page,
    currentQ = q
  ) {
    setListLoading(true);
    setListError(null);
    try {
      const params = new URLSearchParams({
        scope: currentScope,
        page: String(currentPage),
        view: "assistant",
      });
      if (currentQ.trim()) params.set("q", currentQ.trim());

      const res = await fetch(`/api/appointments?${params.toString()}`, {
        cache: "no-store",
      });
      const j: ListResp = await res.json();
      if (!res.ok) throw new Error((j as any)?.error || `Failed (${res.status})`);
      setList(j);
    } catch (e: any) {
      setList(null);
      setListError(e.message || "Failed to load appointments");
    } finally {
      setListLoading(false);
    }
  }

  useEffect(() => {
    void loadList(scope, 1, q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  useEffect(() => {
    let cancelled = false;
    async function searchPatients() {
      const qq = debouncedPatientQuery.trim();
      if (!qq) {
        if (!cancelled) setPatientOptions([]);
        return;
      }

      setPatientSearchLoading(true);
      try {
        const url = `/api/appointments/patients?q=${encodeURIComponent(qq)}`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) setPatientOptions([]);
          return;
        }
        const data = await res.json();
        if (!cancelled) setPatientOptions((data.items ?? []) as PatientPick[]);
      } catch {
        if (!cancelled) setPatientOptions([]);
      } finally {
        if (!cancelled) setPatientSearchLoading(false);
      }
    }

    void searchPatients();
    return () => {
      cancelled = true;
    };
  }, [debouncedPatientQuery]);

  async function handleBook() {
    if (!patient?.id) return setBookingError("Please select a patient.");
    if (!selectedDay) return setBookingError("Please select a date.");
    if (!selectedTime) return setBookingError("Please select a time slot.");

    setBooking(true);
    setBookingError(null);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          day: selectedDay,
          time: selectedTime,
          notes: notes || undefined,
          patientId: patient.id,
        }),
      });

      const j = await res.json().catch(() => ({} as any));

      if (!res.ok) throw new Error(j?.error || `Failed to book (${res.status})`);
      if (j && typeof j === "object" && j.ok === false) {
        throw new Error(j?.error || `Failed to book (${res.status})`);
      }

      setNotes("");
      setSelectedTime("");
      await loadList(scope, page, q);

      const av = await fetch(
        `/api/appointments/availability?day=${encodeURIComponent(selectedDay)}`,
        { cache: "no-store" }
      );
      if (av.ok) {
        const data: AvailabilityResp = await av.json();
        setSlots(data.slots || []);
      }
    } catch (e: any) {
      setBookingError(e.message || "Failed to book appointment");
    } finally {
      setBooking(false);
    }
  }

  async function cancelAppointment(idLike: AnyId) {
    const id = idToString(idLike);
    if (!id) return alert("Invalid appointment id");
    if (!confirm("Cancel this appointment?")) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/appointments/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });

      const j = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(j?.error || `Failed to cancel (${res.status})`);

      await loadList(scope, page, q);

      const av = await fetch(
        `/api/appointments/availability?day=${encodeURIComponent(selectedDay)}`,
        { cache: "no-store" }
      );
      if (av.ok) {
        const data: AvailabilityResp = await av.json();
        setSlots(data.slots || []);
      }
    } catch (e: any) {
      alert(e?.message || "Failed to cancel");
    } finally {
      setSaving(false);
    }
  }

  const headerLabel = useMemo(() => {
    const d = new Date(`${selectedDay}T00:00:00`);
    return d.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, [selectedDay]);

  const totalSlots = slots.length;
  const availableSlots = slots.filter((s) => s.available).length;
  const canBook =
    !!patient?.id && !!selectedDay && !!selectedTime && !booking && !slotsLoading;

  const pageSize = list?.pageSize ?? list?.limit ?? 10;

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: Booking card */}
        <section className="card p-5 space-y-4 lg:col-span-1">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold leading-tight">
                Book an Appointment
              </h2>
            </div>

            <div className="text-[11px] text-neutral-500 text-right leading-tight max-w-[150px]">
              {headerLabel}
            </div>
          </div>

          <div className="sm:hidden">
            <button
              type="button"
              onClick={() => setCalendarOpen((v) => !v)}
              className="w-full rounded-xl border px-3 py-2 text-sm bg-white hover:bg-gray-50 flex items-center justify-between"
            >
              <span>{calendarOpen ? "Hide calendar" : "Show calendar"}</span>
              <span className="text-xs opacity-60">{selectedDay}</span>
            </button>
          </div>

          {(calendarOpen || typeof window === "undefined") && (
            <div className="flex justify-center pt-1">
              <div className="w-full max-w-[320px]">
                <Calendar
                  selectedDay={selectedDay}
                  onSelectDate={(d) => setSelectedDay(toYmd(d))}
                />
              </div>
            </div>
          )}

          <div className="text-xs text-neutral-600">
            <div className="font-medium">Selected Date</div>
            <div className="mt-1 inline-flex items-center px-3 py-1 rounded-full bg-gray-100 text-[13px]">
              {selectedDay || "—"}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-neutral-600">
              Patient <span className="text-rose-500">*</span>
            </label>

            {!patient && (
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                placeholder="Search name or email…"
                value={patientQuery}
                onChange={(e) => setPatientQuery(e.target.value)}
              />
            )}

            {patient && (
              <div className="mt-1 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-2 rounded-xl flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {patient.name ?? "Unnamed"}
                  </div>
                  <div className="text-[11px] opacity-80 truncate">
                    {patient.email ?? "—"}
                  </div>
                </div>
                <button
                  type="button"
                  className="text-[11px] underline whitespace-nowrap"
                  onClick={() => {
                    setPatient(null);
                    setPatientQuery("");
                    setPatientOptions([]);
                  }}
                >
                  Change
                </button>
              </div>
            )}

            {!patient && patientSearchLoading && (
              <div className="mt-1 text-[11px] text-neutral-500">Searching…</div>
            )}

            {!patient && patientOptions.length > 0 && (
              <div className="mt-1 max-h-40 overflow-y-auto rounded-xl border bg-white shadow-sm text-sm">
                {patientOptions.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-gray-50"
                    onClick={() => {
                      setPatient(p);
                      setPatientOptions([]);
                      setPatientQuery("");
                    }}
                  >
                    <div className="font-medium">{p.name ?? "Unnamed"}</div>
                    <div className="text-xs text-neutral-500">
                      {p.email ?? "—"}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs text-neutral-600">
              Time Slot <span className="text-rose-500">*</span>
            </label>
            <select
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm bg-white"
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              disabled={slotsLoading || totalSlots === 0}
            >
              <option value="">Choose a time</option>
              {slots.map((s) => (
                <option key={s.time} value={s.time} disabled={!s.available}>
                  {s.time} {s.available ? "" : "(taken)"}
                </option>
              ))}
            </select>

            <div className="mt-1 text-[11px] text-neutral-500">
              {slotsLoading
                ? "Checking availability…"
                : totalSlots === 0
                ? "No slots defined for this day."
                : `${availableSlots} available / ${totalSlots} total`}
            </div>

            {slotsError && (
              <div className="mt-1 text-[11px] text-rose-600">{slotsError}</div>
            )}
          </div>

          <div>
            <label className="text-xs text-neutral-600">Notes (optional)</label>
            <textarea
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm min-h-[84px]"
              placeholder="Anything the doctor should know…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {bookingError && (
            <div className="text-xs text-rose-600">{bookingError}</div>
          )}

          <div className="pt-1">
            <button
              type="button"
              onClick={() => void handleBook()}
              disabled={!canBook}
              className="w-full rounded-xl py-2.5 text-sm font-medium text-white disabled:opacity-60"
              style={{ background: "#b7a3ff" }}
            >
              {booking ? "Booking…" : "Book Appointment"}
            </button>
          </div>
        </section>

        {/* RIGHT: List */}
        <section className="card p-5 space-y-4 lg:col-span-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2 text-sm">
              {(["upcoming", "past", "all"] as Scope[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`px-3 py-1.5 rounded-full ${
                    scope === s
                      ? "bg-black text-white"
                      : "bg-white border border-[var(--border)] hover:bg-black/5"
                  }`}
                  onClick={() => {
                    setScope(s);
                    setPage(1);
                  }}
                >
                  {s === "upcoming" ? "Upcoming" : s === "past" ? "Past" : "All"}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2 w-full sm:w-auto">
              <input
                className="w-full sm:w-64 rounded-xl px-3 py-2 ring-1 ring-[var(--border)] text-sm min-w-0"
                placeholder="Search notes, email or YYYY-MM-DD"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <button
                type="button"
                className="w-full sm:w-auto px-3 py-2 rounded-lg border text-sm hover:bg-gray-50"
                onClick={() => {
                  setPage(1);
                  void loadList(scope, 1, q);
                }}
              >
                Refresh
              </button>
            </div>
          </div>

          {listError && <div className="text-sm text-rose-600">{listError}</div>}

          {listLoading ? (
            <div className="text-sm text-neutral-500">Loading…</div>
          ) : !list || list.items.length === 0 ? (
            <div className="text-sm text-neutral-500">No appointments to show.</div>
          ) : (
            <div className="flex flex-col gap-3">
              {list.items.map((a) => {
                const idStr = idToString(a._id);
                return (
                  <div
                    key={idStr || `${a.day}-${a.time}`}
                    className="rounded-2xl border px-4 py-4 bg-white flex flex-col gap-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-sm font-medium leading-snug">
                        {formatDateTime(a)}
                      </div>
                      <span
                        className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${statusPillClass(
                          a.status
                        )}`}
                      >
                        {formatStatusLabel(a.status)}
                      </span>
                    </div>

                    <div className="text-xs text-neutral-600">
                      Patient:{" "}
                      <span className="font-medium">
                        {a.patientFullName || a.patientName || a.patientEmail || "—"}
                      </span>
                    </div>

                    {a.notes && (
                      <div className="text-xs text-neutral-600">Notes: {a.notes}</div>
                    )}

                    {a.status !== "cancelled" && (
                      <div className="pt-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => void cancelAppointment(a._id)}
                          disabled={saving || !idStr}
                          className="px-3 py-1.5 rounded-lg border text-xs hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {typeof list?.total === "number" && (
                <div className="text-xs text-neutral-500">
                  Showing {list.items.length} of {list.total}
                </div>
              )}
            </div>
          )}

          {list && pageSize && list.total > pageSize && (
            <div className="flex items-center gap-2 justify-end pt-2">
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg border text-xs hover:bg-gray-50"
                onClick={() => {
                  const next = Math.max(1, page - 1);
                  setPage(next);
                  void loadList(scope, next, q);
                }}
                disabled={page <= 1}
              >
                Prev
              </button>
              <div className="text-xs text-neutral-500">
                Page {list.page} of {Math.ceil(list.total / pageSize)}
              </div>
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg border text-xs hover:bg-gray-50"
                onClick={() => {
                  const next = page + 1;
                  setPage(next);
                  void loadList(scope, next, q);
                }}
                disabled={list.page * pageSize >= list.total}
              >
                Next
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}