"use client";

import { useEffect, useMemo, useState } from "react";

type CalendarProps = {
  selectedDay: string | undefined; // "YYYY-MM-DD"
  onSelectDate?: (date: Date) => void;
  firstDayOfWeek?: 0 | 1;
};

function toYmd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

export default function Calendar({
  selectedDay,
  onSelectDate,
  firstDayOfWeek = 0,
}: CalendarProps) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d;
  }, []);

  const [visibleMonth, setVisibleMonth] = useState<Date>(() => {
    if (selectedDay) {
      const [y, m] = selectedDay.split("-").map(Number);
      return new Date(y, m - 1, 1, 12);
    }
    return new Date(today.getFullYear(), today.getMonth(), 1, 12);
  });

  useEffect(() => {
    if (!selectedDay) return;
    const [y, m] = selectedDay.split("-").map(Number);
    const next = new Date(y, m - 1, 1, 12);
    if (
      next.getFullYear() !== visibleMonth.getFullYear() ||
      next.getMonth() !== visibleMonth.getMonth()
    ) {
      setVisibleMonth(next);
    }
  }, [selectedDay]); // eslint-disable-line

  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const startOfMonth = new Date(year, month, 1, 12);
  const endOfMonth = new Date(year, month + 1, 0, 12);
  const daysInMonth = endOfMonth.getDate();
  const startDayRaw = startOfMonth.getDay();
  const startOffset = (startDayRaw - firstDayOfWeek + 7) % 7;

  const weekdays =
    firstDayOfWeek === 0
      ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
      : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // Block dates:
  // - past dates
  // - Sundays
  function isBlocked(y: number, m: number, d: number) {
    const probe = new Date(y, m, d, 12);

    // Past dates
    if (probe < today) return true;

    // Sunday (0)
    if (probe.getDay() === 0) return true;

    return false;
  }

  function handlePick(day: number | null) {
    if (!day) return;
    if (isBlocked(year, month, day)) return;
    onSelectDate?.(new Date(year, month, day, 12));
  }

  const days: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const isSelected = (d: number) => {
    if (!selectedDay) return false;
    const [Y, M, D] = selectedDay.split("-").map(Number);
    return Y === year && M - 1 === month && D === d;
  };

  const monthLabel = visibleMonth.toLocaleString("default", {
    month: "long",
  });

  return (
    <div className="w-full">
      {/* Month header */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          className="h-8 w-8 rounded-md ring-1 ring-[var(--border)] hover:bg-gray-50"
          aria-label="Previous month"
          onClick={() => setVisibleMonth(new Date(year, month - 1, 1, 12))}
        >
          ‹
        </button>

        <div className="font-semibold">
          {monthLabel} {year}
        </div>

        <button
          type="button"
          className="h-8 w-8 rounded-md ring-1 ring-[var(--border)] hover:bg-gray-50"
          aria-label="Next month"
          onClick={() => setVisibleMonth(new Date(year, month + 1, 1, 12))}
        >
          ›
        </button>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 text-center text-sm font-medium text-gray-500 mb-2">
        {weekdays.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          const disabled = d == null || isBlocked(year, month, d);

          const base =
            "aspect-square flex items-center justify-center rounded-lg text-sm transition";

          const variant = disabled
            ? "opacity-40 cursor-not-allowed"
            : isSelected(d!)
            ? "bg-indigo-600 text-white"
            : "hover:bg-gray-100";

          return (
            <button
              key={i}
              disabled={disabled}
              className={`${base} ${variant}`}
              onClick={() => handlePick(d)}
            >
              {d ?? ""}
            </button>
          );
        })}
      </div>

      {/* Today button */}
      <div className="mt-3">
        <button
          type="button"
          className="text-xs px-2 py-1 rounded-md ring-1 ring-[var(--border)] hover:bg-gray-50"
          onClick={() => {
            setVisibleMonth(
              new Date(today.getFullYear(), today.getMonth(), 1, 12)
            );
            onSelectDate?.(new Date(today));
          }}
        >
          Today ({toYmd(today)})
        </button>
      </div>
    </div>
  );
}
