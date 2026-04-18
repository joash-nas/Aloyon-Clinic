// src/app/api/appointments/reminders/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { sendAppointmentReminderEmail } from "@/lib/appointment-reminders";

const REMINDER_SECRET = process.env.APPOINTMENT_REMINDER_SECRET;

/* cron endpoint to send email reminders for upcoming appointments */
export async function GET(req: NextRequest) {
  // secret check for cron caller
  if (!REMINDER_SECRET) {
    console.error(
      "[appointments/reminders] APPOINTMENT_REMINDER_SECRET is not configured."
    );
    return NextResponse.json(
      { ok: false, error: "Reminder secret not configured." },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  if (!secret || secret !== REMINDER_SECRET) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const db = await getDb();
  const coll = db.collection("appointments");

  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // pick upcoming appointments with no reminder yet
  const cursor = coll.find(
    {
      date: { $gte: now, $lte: in24h },
      status: { $in: ["booked", "confirmed"] },
      reminderEmailSent: { $ne: true },
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
  );

  const toRemind = await cursor.toArray();
  let successCount = 0;
  let failCount = 0;

  // send email + mark as reminded
  for (const appt of toRemind) {
    const id = appt._id;
    const email = appt.patientEmail as string | null;
    if (!email) continue;

    try {
      await sendAppointmentReminderEmail({
        to: email,
        patientName: (appt.patientName as string | null) ?? undefined,
        day: appt.day as string,
        time: appt.time as string,
      });

      await coll.updateOne(
        { _id: id },
        {
          $set: {
            reminderEmailSent: true,
            reminderEmailSentAt: new Date(),
          },
        }
      );
      successCount++;
    } catch (err) {
      console.error(
        "[appointments/reminders] Failed to send reminder for",
        id,
        err
      );
      failCount++;
    }
  }

  return NextResponse.json({
    ok: true,
    processed: toRemind.length,
    sent: successCount,
    failed: failCount,
  });
}
