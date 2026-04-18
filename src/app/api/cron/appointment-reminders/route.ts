/* =============================================================================
   File: src/app/api/cron/appointment-reminders/route.ts
   Purpose:
     - Cron-style endpoint to send appointment reminder emails.
     - Intended to be called by a scheduler (e.g. Vercel Cron Job) once a day.
   Security:
     - Protected with a simple token in the query string:
         /api/cron/appointment-reminders?token=YOUR_SECRET
       where YOUR_SECRET = process.env.APPOINTMENT_REMINDER_SECRET
   Behavior:
     - Delegates to sendUpcomingAppointmentReminders(), which:
         • scans appointments in configured time windows
           (e.g. 24h before, 12h before — defined in the lib),
         • sends reminder emails,
         • and sets reminder flags on those appointments.
   ============================================================================ */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { sendUpcomingAppointmentReminders } from "@/lib/appointment-reminders";

const CRON_SECRET = process.env.APPOINTMENT_REMINDER_SECRET;

export async function GET(req: NextRequest) {
  if (!CRON_SECRET) {
    console.warn(
      "[/api/cron/appointment-reminders] APPOINTMENT_REMINDER_SECRET not set."
    );
    return NextResponse.json(
      { ok: false, error: "Cron secret not configured." },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token || token !== CRON_SECRET) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
  
    const result = await sendUpcomingAppointmentReminders();

    return NextResponse.json(
      {
        ok: true,
        ...result,
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("[/api/cron/appointment-reminders] error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Internal error" },
      { status: 500 }
    );
  }
}
