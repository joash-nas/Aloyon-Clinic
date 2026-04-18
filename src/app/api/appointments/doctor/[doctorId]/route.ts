// src/app/api/appointments/doctor/[doctorId]/route.ts

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

/* appointments for one doctor by id (upcoming only) */
export async function GET(
  req: Request,
  { params }: { params: { doctorId: string } }
) {
  const session = await getServerSession(authOptions);

  // auth check
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // only allow this doctor account
  if (session.user.id !== params.doctorId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const db = await getDb();

    // upcoming booked appointments for this doctor
    const appointments = await db
      .collection("appointments")
      .find({
        doctorId: new ObjectId(params.doctorId),
        status: "booked",
        date: { $gte: new Date() },
      })
      .sort({ date: 1 })
      .toArray();

    // normalize ids to string for the client
    const response = appointments.map((app) => ({
      _id: app._id.toString(),
      userId: app.userId.toString(),
      date: app.date,
      status: app.status,
      notes: app.notes,
    }));

    return NextResponse.json({ appointments: response });
  } catch (err) {
    console.error("GET /api/appointments/doctor/[doctorId]", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
