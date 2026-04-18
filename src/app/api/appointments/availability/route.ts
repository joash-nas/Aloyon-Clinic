/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/appointments/availability/route.ts
// Returns the available appointment time slots for a given day and doctor.
// - Slots are blocked if there is an appointment with status "booked" or "confirmed".
// - Sundays are treated as closed (no slots available).

import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { z } from "zod";
import { ObjectId } from "mongodb";
import { resolveDefaultDoctorId } from "../_utils";

// day=YYYY-MM-DD  doctorId=<id>
const Query = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  doctorId: z.string().length(24).optional(),
});

// Clinic hours: 9am-5pm
const SLOT_TIMES = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
];

function isValidObjectId(s: string) {
  return /^[a-f\d]{24}$/i.test(s);
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const dayParam = url.searchParams.get("day") || url.searchParams.get("date") || "";

    const q = Query.safeParse({
      day: dayParam,
      doctorId: url.searchParams.get("doctorId") || undefined,
    });

    if (!q.success) {
      return NextResponse.json({ error: "Invalid query" }, { status: 400 });
    }

    const db = await getDb();

    const doctorId =
      q.data.doctorId && isValidObjectId(q.data.doctorId)
        ? new ObjectId(q.data.doctorId)
        : await resolveDefaultDoctorId(db);

    // Parse the requested day (local probe only for Sunday check)
    const [Y, M, D] = q.data.day.split("-").map(Number);
    const dayProbe = new Date(Y, M - 1, D, 12);

    // Close slots on Sunday
    if (dayProbe.getDay() === 0) {
      const closed = SLOT_TIMES.map((t) => ({ time: t, available: false }));
      return NextResponse.json({ day: q.data.day, slots: closed }, { status: 200 });
    }

    // FIX: Look up booked/confirmed by doctorId + day, then use stored "time"
    const booked = await db
      .collection("appointments")
      .find(
        {
          doctorId,
          day: q.data.day,
          status: { $in: ["booked", "confirmed"] },
        },
        { projection: { time: 1 } }
      )
      .toArray();

    const taken = new Set(
      booked
        .map((b: any) => String(b?.time || ""))
        .filter((t: string) => /^\d{2}:\d{2}$/.test(t))
    );

    const slots = SLOT_TIMES.map((time) => ({
      time,
      available: !taken.has(time),
    }));

    return NextResponse.json({ day: q.data.day, slots }, { status: 200 });
  } catch (e) {
    console.error("availability GET", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}