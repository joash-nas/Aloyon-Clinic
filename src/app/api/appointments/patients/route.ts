/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/appointments/patients/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";

function escapeRx(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* search patients for appointment booking (staff use) */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as any).role;
  if (!["assistant", "doctor", "admin"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const limit = Math.min(
    20,
    Math.max(1, Number(searchParams.get("limit") || 10))
  );

  const db = await getDb();
  const col = db.collection("users");

  // base filter: only patient role
  const match: any = { role: "patient" };

  // optional name/email search
  if (q) {
    const rx = new RegExp(escapeRx(q), "i");
    match.$or = [{ email: rx }, { name: rx }];
  }

  const items = await col
    .find(match, { projection: { _id: 1, email: 1, name: 1 } })
    .limit(limit)
    .toArray();

  return NextResponse.json({
    ok: true,
    items: items.map((u) => ({
      id: String(u._id),
      email: u.email ?? null,
      name: u.name ?? null,
    })),
  });
}
