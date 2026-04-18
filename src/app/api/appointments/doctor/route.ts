// src/app/api/appointments/doctor/route.ts

import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb"; 
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { resolveDefaultDoctorId } from "../_utils";

/* doctor appointments list with patient name + email */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDb();
    const doctorId = await resolveDefaultDoctorId(db);

    const items = await db
      .collection("appointments")
      .aggregate([
        // doctor booked appointments
        { $match: { doctorId, status: "booked" } },
        // join patient info
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "patient",
          },
        },
        { $unwind: "$patient" },
        
        {
          $project: {
            _id: 1,
            day: 1,
            time: 1,
            notes: 1,
            status: 1,
            patientName: {
              $ifNull: [
                "$patient.profile.fullName",
                { $ifNull: ["$patient.name", "$patient.email"] },
              ],
            },
            patientEmail: "$patient.email",
          },
        },
        { $sort: { day: 1 as const, time: 1 as const } },
      ])
      .toArray();

    return NextResponse.json({ items });
  } catch (e) {
    console.error("GET /api/appointments/doctor error", e);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
