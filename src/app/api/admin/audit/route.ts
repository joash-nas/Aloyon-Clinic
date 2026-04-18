// src/app/api/admin/audit/route.ts
// Returns the latest audit log entries for the Security & Audit page.
// Accessible to admin users only.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";

export async function GET() {
  // Check that the request comes from a logged-in admin.
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = await getDb();

  // Return the 50 most recent audit logs, newest first.
  const logs = await db
    .collection("audit_logs")
    .find({}, { projection: { _id: 0 } })
    .sort({ timestamp: -1 })
    .limit(50)
    .toArray();

  return NextResponse.json({ logs });
}
