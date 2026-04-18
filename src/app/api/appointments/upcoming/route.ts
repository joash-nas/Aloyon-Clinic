/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/appointments/upcoming/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

/* upcoming appointments for doctors and staff (with paging + search) */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = Math.min(
    50,
    Math.max(1, Number(searchParams.get("pageSize") || 10))
  );
  const q = (searchParams.get("q") || "").trim();
  const doctorIdParam = searchParams.get("doctorId");

  const db = await getDb();
  const col = db.collection("appointments");

  // base filter: future dates and active status
  const match: any = {
    date: { $gte: new Date() },
    status: { $in: ["booked", "confirmed"] },
  };

  const role = (session.user as any).role;
  const userId = (session.user as any).id || (session.user as any)._id;

  // doctor sees own upcoming appointments
  if (role === "doctor") {
    if (!userId) {
      return NextResponse.json({ error: "Bad session" }, { status: 400 });
    }
    match.doctorId = new ObjectId(String(userId));
  } else if (role === "assistant" || role === "admin") {
    
    if (doctorIdParam) {
      match.doctorId = new ObjectId(doctorIdParam);
    }
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const pipeline: any[] = [
    { $match: match },
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
  ];

  // optional search on notes/date/patient
  if (q) {
    pipeline.push({
      $match: {
        $or: [
          { notes: { $regex: q, $options: "i" } },
          { ymd: { $regex: q, $options: "i" } },
          { "patient.email": { $regex: q, $options: "i" } },
          { "patient.name": { $regex: q, $options: "i" } },
        ],
      },
    });
  }

  // sort + paging with facet
  pipeline.push(
    { $sort: { date: 1, time: 1 } },
    {
      $facet: {
        items: [{ $skip: (page - 1) * pageSize }, { $limit: pageSize }],
        total: [{ $count: "count" }],
      },
    }
  );

  const [res] = await col.aggregate(pipeline).toArray();

  const items = (res?.items || []).map((d: any) => ({
    id: String(d._id),
    ymd: d.ymd,
    time: d.time,
    date: d.date instanceof Date ? d.date.toISOString() : d.date,
    status: d.status,
    notes: d.notes || "",
    patient: d.patient || null,
  }));
  const total = res?.total?.[0]?.count || 0;

  return NextResponse.json(
    { ok: true, items, page, pageSize, total },
    { status: 200 }
  );
}
