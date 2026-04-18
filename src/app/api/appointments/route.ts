/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/appointments/route.ts

import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { resolveDefaultDoctorId } from "./_utils";
import { sendAppointmentConfirmationEmail } from "@/lib/appointment-reminders";

const ListQuery = z.object({
  scope: z.enum(["upcoming", "past", "all"]).optional().default("upcoming"),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(50).optional().default(5),
  q: z.string().optional(),
});

const CreateSchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  notes: z.string().max(1000).optional(),
  doctorId: z.string().length(24).optional(),
  patientId: z.string().length(24).optional(), // for staff booking
});

/**
 * Manila clinic time (UTC+8, no DST) -> UTC instant Date
 * Example: 2026-03-03 09:00 Manila => 2026-03-03 01:00Z
 */
function manilaToUtcInstant(day: string, time: string) {
  const [Y, M, D] = day.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(Date.UTC(Y, M - 1, D, hh - 8, mm, 0, 0));
}

/* create appointment */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user as any).role as string | undefined;

    const body = await req.json().catch(() => ({}));
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { day, time, notes } = parsed.data;

    // clinic closed on Sundays (local probe only)
    const [Y, M, D] = day.split("-").map(Number);
    const localDayProbe = new Date(Y, M - 1, D, 12, 0, 0, 0);
    if (localDayProbe.getDay() === 0) {
      return NextResponse.json(
        { error: "Clinic is closed on Sundays." },
        { status: 400 }
      );
    }

    // clinic hours 09:00–17:00, whole hour only (PH time)
    const [hhStr, mmStr] = time.split(":");
    const hh = Number(hhStr);
    const mm = Number(mmStr);

    if (Number.isNaN(hh) || Number.isNaN(mm) || mm !== 0 || hh < 9 || hh > 17) {
      return NextResponse.json(
        {
          error:
            "Time must be within clinic hours (09:00–17:00, Philippine time).",
        },
        { status: 400 }
      );
    }

    const db = await getDb();

    // decide patient (self or chosen patient)
    const isStaff = !!role && ["assistant", "doctor", "admin"].includes(role);
    const patientObjectId =
      isStaff && parsed.data.patientId
        ? new ObjectId(parsed.data.patientId)
        : new ObjectId(session.user.id);

    // ensure patient exists and role is patient
    const patient = await db.collection("users").findOne(
      { _id: patientObjectId },
      { projection: { name: 1, email: 1, role: 1 } }
    );
    if (!patient || patient.role !== "patient") {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    const doctorId = parsed.data.doctorId
      ? new ObjectId(parsed.data.doctorId)
      : await resolveDefaultDoctorId(db);

    // store UTC instant of Manila clinic time
    const date = manilaToUtcInstant(day, time);

    // FIX: block conflicts by doctorId + day + time (not date)
    const active = await db.collection("appointments").findOne({
      doctorId,
      day,
      time,
      status: { $in: ["booked", "confirmed"] },
    });
    if (active) {
      return NextResponse.json(
        { error: "Slot already taken. Please pick another time." },
        { status: 409 }
      );
    }

    const doc = {
      userId: patientObjectId,
      doctorId,
      day,
      time,
      date,
      notes: notes ?? null,
      status: "booked" as const,
      createdAt: new Date(),
      patientEmail: patient.email ?? null,
      patientName: patient.name ?? null,
      reminderEmailSent: false,
    };

    const coll = db.collection("appointments");
    const r = await coll.insertOne(doc);
    const inserted = await coll.findOne({ _id: r.insertedId });

    // send confirmation email (errors are logged only)
    if (inserted?.patientEmail) {
      try {
        await sendAppointmentConfirmationEmail({
          to: inserted.patientEmail,
          patientName: inserted.patientName ?? undefined,
          day: inserted.day,
          time: inserted.time,
          notes: inserted.notes ?? undefined,
        });
      } catch (e) {
        console.error("[appointments POST] Failed to send confirmation email:", e);
      }
    }

    return NextResponse.json({ ok: true, appointment: inserted }, { status: 201 });
  } catch (err: any) {
    if (err?.code === 11000) {
      return NextResponse.json(
        { error: "Slot already taken. Please pick another time." },
        { status: 409 }
      );
    }
    console.error("POST /api/appointments error", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/* list appointments (patient or assistant or doctor view) */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const role = (session.user as any).role as string | undefined;

    const url = new URL(req.url);
    const parsed = ListQuery.safeParse({
      scope: url.searchParams.get("scope") || undefined,
      page: url.searchParams.get("page") || undefined,
      limit: url.searchParams.get("limit") || undefined,
      q: url.searchParams.get("q") || undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid query" }, { status: 400 });
    }

    const { scope, page, limit, q } = parsed.data;
    const view = url.searchParams.get("view"); // "assistant" | "doctor"

    const db = await getDb();
    const now = new Date();

    const isStaff = !!role && ["assistant", "doctor", "admin"].includes(role);
    const asAssistantView = isStaff && view === "assistant";
    const asDoctorView = role === "doctor" && view === "doctor";

    // filter: patient view vs staff view
    const match: Record<string, any> = {};

    if (asDoctorView) {
      match.doctorId = new ObjectId(session.user.id);
    } else if (!asAssistantView) {
      match.userId = new ObjectId(session.user.id);
    }

    // date range filter (uses UTC instant)
    if (scope === "upcoming") {
      match.status = { $in: ["booked", "confirmed"] };
      match.date = { $gte: now };
    } else if (scope === "past") {
      match.date = { $lt: now };
    }

    // optional search
    if (q && q.trim()) {
      const qq = q.trim();
      const rx = new RegExp(qq.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      match.$or = [
        { notes: rx },
        { day: qq },
        { time: qq },
        { patientEmail: rx },
        { patientName: rx },
      ];
    }

    const sort: Record<string, 1 | -1> =
      scope === "past"
        ? { date: -1, day: -1, time: -1 }
        : { date: 1, day: 1, time: 1 };

    const coll = db.collection("appointments");
    const total = await coll.countDocuments(match);

    const isStaffList = asAssistantView || asDoctorView || role === "admin";

    // Staff list: include patientFullName
    if (isStaffList) {
      const pipeline: any[] = [
        { $match: match },
        { $sort: sort },
        { $skip: (page - 1) * limit },
        { $limit: limit + 1 },

        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "patientUser",
          },
        },
        { $unwind: { path: "$patientUser", preserveNullAndEmptyArrays: true } },

        {
          $addFields: {
            patientFullName: {
              $ifNull: [
                "$patientUser.profile.fullName",
                { $ifNull: ["$patientUser.name", "$patientEmail"] },
              ],
            },
          },
        },

        {
          $project: {
            _id: 1,
            day: 1,
            time: 1,
            date: 1,
            notes: 1,
            status: 1,
            createdAt: 1,
            patientEmail: 1,
            patientName: 1,
            patientFullName: 1,
            userId: 1,
            doctorId: 1,
          },
        },
      ];

      const docs = await coll.aggregate(pipeline).toArray();
      const hasMore = docs.length > limit;
      const items = hasMore ? docs.slice(0, limit) : docs;

      return NextResponse.json({
        items,
        page,
        pageSize: limit,
        hasMore,
        total,
      });
    }

    // Patient view
    const cursor = coll
      .find(match, {
        projection: {
          _id: 1,
          day: 1,
          time: 1,
          date: 1,
          notes: 1,
          status: 1,
          createdAt: 1,
          patientEmail: 1,
          patientName: 1,
          userId: 1,
          doctorId: 1,
        },
      })
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit + 1);

    const docs = await cursor.toArray();
    const hasMore = docs.length > limit;
    const items = hasMore ? docs.slice(0, limit) : docs;

    return NextResponse.json({
      items,
      page,
      pageSize: limit,
      hasMore,
      total,
    });
  } catch (err) {
    console.error("GET /api/appointments error", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}