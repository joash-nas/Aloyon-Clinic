/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/admin/summary/route.ts
// Provides basic admin dashboard statistics about user accounts.

import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const dynamic = "force-dynamic";

type UserDoc = {
  _id: any;
  role?: string;
};

export async function GET(_req: Request) {
  try {
    // Only logged-in users can access this endpoint.
    // In practice, the UI only calls this from the admin dashboard.
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const db = await getDb();
    const usersCol = db.collection<UserDoc>("users");

    // Count users for each of the supported roles.
    const roles = [
      "admin",
      "doctor",
      "assistant",
      "sales",
      "supplier",
      "patient",
    ];
    const roleCounts = await Promise.all(
      roles.map((r) => usersCol.countDocuments({ role: r }))
    );

    const usersByRole: Record<string, number> = {};
    roles.forEach((r, i) => {
      usersByRole[r] = roleCounts[i];
    });

    const usersTotal = await usersCol.countDocuments();

    return NextResponse.json({
      usersTotal,
      usersByRole: {
        admin: usersByRole["admin"] ?? 0,
        doctor: usersByRole["doctor"] ?? 0,
        assistant: usersByRole["assistant"] ?? 0,
        sales: usersByRole["sales"] ?? 0,
        supplier: usersByRole["supplier"] ?? 0,
        patient: usersByRole["patient"] ?? 0,
      },
    });
  } catch (err) {
    console.error("[GET /api/admin/summary] error:", err);
    return NextResponse.json(
      { error: "Failed to load admin summary" },
      { status: 500 }
    );
  }
}
