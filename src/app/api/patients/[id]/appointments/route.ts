/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/patients/[id]/appointments/route.ts
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const _id = new ObjectId(id);

    const url = new URL(req.url);
    const scope = (url.searchParams.get("scope") || "booked") as
      | "booked"
      | "cancelled"
      | "done"
      | "all";

    const page = Math.max(parseInt(url.searchParams.get("page") || "1", 10), 1);
    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get("limit") || "5", 10), 1),
      50
    );
    const skip = (page - 1) * limit;

    const db = await getDb();

    const match: any = { userId: _id };
    if (scope !== "all") match.status = scope;

    const total = await db.collection("appointments").countDocuments(match);

    const items = await db
      .collection("appointments")
      .find(match, {
        projection: {
          _id: 1,
          day: 1,
          time: 1,
          date: 1,
          status: 1,
          notes: 1,
          createdAt: 1,
        },
      })
      .sort({ date: 1, day: 1, time: 1 }) 
      .skip(skip)
      .limit(limit)
      .toArray();

    return NextResponse.json({
      items,
      page,
      limit,
      total,
      hasMore: skip + items.length < total,
    });
  } catch (e) {
    console.error("GET /api/patients/[id]/appointments", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
