// src/app/api/appointments/day/route.ts
// Returns all booked appointments for a specific day for the logged-in doctor.
// Used by the doctor's daily schedule view.

import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { z } from "zod";

// date=YYYY-MM-DD
const Query = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  // Doctor day overview.
  if (!session?.user || session.user.role !== "doctor") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const parsed = Query.safeParse({
    date: url.searchParams.get("date") || "",
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid or missing ?date=YYYY-MM-DD" },
      { status: 400 }
    );
  }

  const [y, m, d] = parsed.data.date.split("-").map(Number);
  const dayStart = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  const dayEnd = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));

  const db = await getDb();

  // Load booked appointments for the selected day and yung basic patient info.
  const items = await db
    .collection("appointments")
    .aggregate([
      {
        $match: {
          status: "booked",
          date: { $gte: dayStart, $lte: dayEnd },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          date: 1,
          createdAt: 1,
          status: 1,
          notes: 1,
          "user.email": 1,
          "user.full_name": 1,
        },
      },
      { $sort: { date: 1 } },
    ])
    .toArray();

  return NextResponse.json({ items });
}
