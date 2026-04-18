// src/lib/clinic-time.ts

export const CLINIC_TZ = "Asia/Manila"; // reference only (not used below)

/** "YYYY-MM-DD" from a JS Date (local). */
export function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Combine day ("YYYY-MM-DD") + time ("HH:mm") into a JS Date (local->UTC). */
export function toUtcInstant(day: string, time: string): Date {
  const [Y, M, D] = day.split("-").map(Number);
  const [h, m] = time.split(":").map(Number);
  return new Date(Y, M - 1, D, h, m, 0, 0);
}
