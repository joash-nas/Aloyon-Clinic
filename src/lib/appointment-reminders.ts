// src/lib/appointment-reminders.ts
// Helper functions for appointment confirmation + reminder emails.
// Uses the shared nodemailer-based sendMail() utility.
// Also contains a helper to scan upcoming appointments and send reminders.

/* eslint-disable @typescript-eslint/no-explicit-any */

import { sendMail } from "@/lib/email";
import { getDb } from "@/lib/mongodb";

/**
 * Format the clinic appointment date/time in a friendly way.
 * Our DB stores:
 *  - day: "YYYY-MM-DD" in Philippine local date
 *  - time: "HH:mm" (24h) in Philippine local time
 *
 * For now we just show that directly; in a future version we can
 * localize based on patient time zone.
 */
export function formatAppointmentLabel(day: string, time: string): string {
  // e.g., "2025-11-20 at 14:00"
  return `${day} at ${time}`;
}

/**
 * Appointment booking confirmation email.
 * Called right after a patient or assistant successfully books an appointment.
 */
export async function sendAppointmentConfirmationEmail(opts: {
  to: string;
  patientName?: string | null;
  day: string;
  time: string;
  notes?: string | null;
}) {
  const { to, patientName, day, time, notes } = opts;
  const when = formatAppointmentLabel(day, time);
  const appName = "Aloyon Optical";

  const safeName = patientName?.trim() || "Patient";

  const notesSection = notes
    ? `<p style="margin: 8px 0 0 0; font-size: 13px; color: #555;">
         Note you provided: <em>${escapeHtml(notes)}</em>
       </p>`
    : "";

  const html = `
    <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif; font-size: 14px; color: #111;">
      <p>Hi ${escapeHtml(safeName)},</p>
      <p>
        This is a confirmation of your appointment at
        <strong>${appName}</strong>.
      </p>
      <p style="font-size: 15px; font-weight: 600; margin: 12px 0;">
        📅 ${escapeHtml(when)} (Philippine time)
      </p>
      ${notesSection}
      <p style="margin-top: 16px;">
        If you need to reschedule, cancel your appointment from your Aloyon Optical account and book again.
      </p>
      <p style="margin-top: 16px; font-size: 12px; color: #666;">
        Please arrive at least 10 minutes before your scheduled time.
      </p>
    </div>
  `;

  await sendMail({
    to,
    subject: `${appName} – Appointment Confirmation (${when})`,
    html,
  });
}

/**
 * Appointment reminder email (used for both 24h-before and 2h-before reminders).
 * This will be triggered by our /api/cron/appointment-reminders route.
 */
export async function sendAppointmentReminderEmail(opts: {
  to: string;
  patientName?: string | null;
  day: string;
  time: string;
  kind?: "24h" | "2h";
}) {
  const { to, patientName, day, time, kind } = opts;
  const when = formatAppointmentLabel(day, time);
  const appName = "Aloyon Optical";

  const safeName = patientName?.trim() || "Patient";

  const label =
    kind === "2h"
      ? "in a few hours"
      : kind === "24h"
      ? "tomorrow"
      : "soon";

  const html = `
    <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif; font-size: 14px; color: #111;">
      <p>Hi ${escapeHtml(safeName)},</p>
      <p>
        This is a friendly reminder of your upcoming appointment at
        <strong>${appName}</strong> ${escapeHtml(label)}.
      </p>
      <p style="font-size: 15px; font-weight: 600; margin: 12px 0;">
        📅 ${escapeHtml(when)} (Philippine time)
      </p>
      <p style="margin-top: 16px;">
        If you need to cancel or reschedule, please log into your Aloyon Optical account
        or contact the clinic as soon as possible.
      </p>
      <p style="margin-top: 16px; font-size: 12px; color: #666;">
        Please arrive at least 10 minutes before your scheduled time.
      </p>
    </div>
  `;

  await sendMail({
    to,
    subject: `${appName} – Appointment Reminder (${when})`,
    html,
  });
}

/**
 * Very small HTML escape helper for safety inside our email templates.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ========================================================================== */
/*  Scheduled reminders helper (24h before & 2h before)                       */
/* ========================================================================== */

export type ReminderKind = "24h" | "2h";

export type ReminderScanResult = {
  totalCandidates: number;
  sent: number;
  errors: number;
  details: {
    id: string;
    kind: ReminderKind;
    status: "sent" | "skipped" | "error";
    error?: string;
  }[];
};

/**
 * Internal helper: send reminders for a particular time window.
 *
 * - kind: "24h" or "2h"
 * - minMinutes / maxMinutes: appointment start must be between now+min and now+max
 * - flagField: Mongo field to store "already sent" flag
 */
async function sendRemindersForWindow(params: {
  kind: ReminderKind;
  minMinutes: number;
  maxMinutes: number;
  flagField: "reminderEmail24hSent" | "reminderEmail2hSent";
}) {
  const { kind, minMinutes, maxMinutes, flagField } = params;

  const db = await getDb();
  const coll = db.collection("appointments");

  const now = new Date();
  const windowStart = new Date(now.getTime() + minMinutes * 60 * 1000);
  const windowEnd = new Date(now.getTime() + maxMinutes * 60 * 1000);

  const candidates = await coll
    .find(
      {
        status: { $in: ["booked", "confirmed"] },
        date: { $gte: windowStart, $lte: windowEnd },
        [flagField]: { $ne: true },
        patientEmail: { $ne: null },
      },
      {
        projection: {
          _id: 1,
          day: 1,
          time: 1,
          patientEmail: 1,
          patientName: 1,
        },
      }
    )
    .toArray();

  const partial = {
    total: candidates.length,
    sent: 0,
    errors: 0,
    details: [] as ReminderScanResult["details"],
  };

  for (const appt of candidates) {
    const id = String(appt._id);

    if (!appt.patientEmail || !appt.day || !appt.time) {
      partial.details.push({
        id,
        kind,
        status: "skipped",
        error: "Missing patientEmail/day/time",
      });
      continue;
    }

    try {
      await sendAppointmentReminderEmail({
        to: appt.patientEmail,
        patientName: appt.patientName ?? undefined,
        day: appt.day,
        time: appt.time,
        kind,
      });

      await coll.updateOne(
        { _id: appt._id },
        {
          $set: {
            [flagField]: true,
            reminderEmailLastSentAt: new Date(),
          },
        }
      );

      partial.sent += 1;
      partial.details.push({ id, kind, status: "sent" });
    } catch (e: any) {
      console.error(
        `[reminders] failed to send ${kind} reminder for`,
        id,
        e
      );
      partial.errors += 1;
      partial.details.push({
        id,
        kind,
        status: "error",
        error: e?.message || "Unknown error",
      });
    }
  }

  return partial;
}

/**
 * Scan upcoming appointments and send reminder emails.
 *
 * We currently do TWO reminder windows:
 *  - Around 24 hours before the appointment:
 *      date between now + (24h - 90min) and now + (24h + 90min)
 *      flag: reminderEmail24hSent
 *  - Around 2 hours before the appointment:
 *      date between now + (2h - 30min) and now + (2h + 30min)
 *      flag: reminderEmail2hSent
 *
 * This function is designed to be called from:
 *   /api/cron/appointment-reminders
 */
export async function sendUpcomingAppointmentReminders(): Promise<ReminderScanResult> {
  // 24h window: from 22.5h to 25.5h before the appointment
  const first = await sendRemindersForWindow({
    kind: "24h",
    minMinutes: 24 * 60 - 90,
    maxMinutes: 24 * 60 + 90,
    flagField: "reminderEmail24hSent",
  });

  // 2h window: from 1.5h to 2.5h before the appointment
  const second = await sendRemindersForWindow({
    kind: "2h",
    minMinutes: 720 - 30,
    maxMinutes: 720 + 30,
    flagField: "reminderEmail2hSent",
  });

  return {
    totalCandidates: first.total + second.total,
    sent: first.sent + second.sent,
    errors: first.errors + second.errors,
    details: [...first.details, ...second.details],
  };
}
