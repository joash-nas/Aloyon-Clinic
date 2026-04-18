/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/staff/suppliers/route.ts
// Returns supplier accounts for product dropdown (assistant/admin only)

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as any).role;
  if (role !== "admin" && role !== "assistant") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const db = await getDb();

  const docs = await db
    .collection("users")
    .find({ role: "supplier" })
    .project({ _id: 1, email: 1, name: 1, full_name: 1, profile: 1 })
    .sort({ createdAt: -1 })
    .toArray();

  const suppliers = docs.map((u: any) => ({
    id: u._id.toString(),
    name:
      u.full_name ??
      u.name ??
      u.profile?.fullName ??
      u.email ??
      "Supplier",
  }));

  return NextResponse.json({ ok: true, suppliers });
}