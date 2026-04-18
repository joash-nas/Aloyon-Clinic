/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/appointments/doctor/upcoming/route.ts

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

/* doctor upcoming appointments with patient info */
export async function GET() {
  const session = await getServerSession(authOptions);

  // auth + role check
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "doctor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = await getDb();
  const doctorId = (session.user as any).id || (session.user as any)._id;
  if (!doctorId) {
    return NextResponse.json({ error: "Bad session" }, { status: 400 });
  }

  // pipeline joins appointments with patient basic info
  const pipeline = [
    {
      $match: {
        status: { $in: ["booked", "confirmed"] },
        date: { $gte: new Date() },
        doctorId: new ObjectId(String(doctorId)),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "patient",
        pipeline: [{ $project: { _id: 0, email: 1, name: 1 } }],
      },
    },
    { $unwind: { path: "$patient", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: { $toString: "$_id" },
        ymd: 1,
        time: 1,
        date: 1,
        status: 1,
        notes: 1,
        patient: 1,
      },
    },
    { $sort: { date: 1, time: 1 } },
  ];

  const items = await db.collection("appointments").aggregate(pipeline).toArray();

  // ensure date is always a string
  const out = items.map((d: any) => ({
    ...d,
    date: d.date instanceof Date ? d.date.toISOString() : d.date,
  }));

  return NextResponse.json({ ok: true, items: out }, { status: 200 });
}
