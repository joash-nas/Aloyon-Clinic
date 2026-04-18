// src/components/appointments/PatientAppointmentList.tsx
"use client";

type Appointment = {
  _id: string;
  day: string; // "YYYY-MM-DD"
  time: string; // "HH:mm"
  date?: string; // ISO (for lead-time checks)
  status?: "booked" | "cancelled" | "done" | string;
  notes?: string | null;
  createdAt?: string;
};

type Props = {
  items: Appointment[];
  onCancel?: (id: string) => Promise<void> | void;
  enableCancel?: boolean;
  cancelLeadMinutes?: number;
  emptyText?: string;
  loading?: boolean;
};

function prettyStatus(s?: string) {
  const v = (s || "booked").toLowerCase();
  return v.charAt(0).toUpperCase() + v.slice(1);
}

function StatusPill({ status }: { status?: string }) {
  const s = (status || "booked").toLowerCase();

  const palette =
    s === "booked"
      ? "bg-emerald-100 text-emerald-700"
      : s === "cancelled"
      ? "bg-rose-100 text-rose-700"
      : s === "done"
      ? "bg-sky-100 text-sky-700"
      : "bg-gray-100 text-gray-700";

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${palette}`}>
      {prettyStatus(s)}
    </span>
  );
}

function passesLeadTime(dateIso?: string, leadMin = 120) {
  if (!dateIso) return true;
  const when = new Date(dateIso).getTime();
  const now = Date.now();
  return when - now >= leadMin * 60 * 1000;
}

/**
 * Always show appointment time in Asia/Manila (clinic time).
 * The DB `date` is UTC instant.
 */
function formatApptDateTime(a: Appointment) {
  try {
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

    // fallback
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
  } catch {
    // ignore
  }

  return `${a.day} • ${a.time}`;
}

export default function PatientAppointmentList({
  items,
  onCancel,
  enableCancel = true,
  cancelLeadMinutes = 0,
  emptyText = "No appointments to show.",
  loading,
}: Props) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl ring-1 ring-[var(--border)] bg-white/60 p-4"
          >
            <div className="h-4 w-40 bg-gray-200 rounded mb-2" />
            <div className="h-3 w-24 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!items || items.length === 0) {
    return <div className="text-sm opacity-70">{emptyText}</div>;
  }

  return (
    <div className="space-y-3">
      {items.map((a) => {
        const dtLabel = formatApptDateTime(a);
        const status = (a.status || "booked").toLowerCase() as Appointment["status"];

        const shouldRespectLead = !!cancelLeadMinutes && cancelLeadMinutes > 0;
        const canCancelByTime =
          !shouldRespectLead || passesLeadTime(a.date, cancelLeadMinutes);

        const showCancel =
          !!onCancel && enableCancel && status === "booked" && canCancelByTime;

        return (
          <div
            key={a._id}
            className="rounded-xl ring-1 ring-[var(--border)] bg-white/70 p-4 flex items-start justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-2">
                <div className="text-base font-medium">{dtLabel}</div>
                <StatusPill status={status} />
              </div>

              {a.notes && (
                <div className="text-sm text-neutral-700 mt-1">“{a.notes}”</div>
              )}

              {a.createdAt && (
                <div className="text-xs opacity-70 mt-1">
                  Booked{" "}
                  {new Date(a.createdAt).toLocaleString(undefined, {
                    year: "numeric",
                    month: "numeric",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {showCancel && (
                <button
                  className="text-sm px-3 py-1.5 rounded-lg border hover:bg-gray-50"
                  onClick={() => onCancel?.(a._id)}
                  title="Cancel this appointment"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}