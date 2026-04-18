/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/assistant/suppliers/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

type Row = {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
};

/* list supplier accounts for PO dropdowns */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;

  // only staff can view suppliers
  if (!session?.user?.id || !role || !["admin", "doctor", "assistant"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = await getDb();

  // pull all supplier users in newest-first order
  const rows = await db
    .collection("users")
    .aggregate<Row>([
      { $match: { role: "supplier" } },
      { $sort: { createdAt: -1 } },
      {
        $project: {
          _id: 0,
          id: { $toString: "$_id" },
          email: 1,
          name: { $ifNull: ["$name", null] },
          created_at: {
            $dateToString: {
              date: { $ifNull: ["$createdAt", "$created_at"] },
              format: "%Y-%m-%dT%H:%M:%S.%LZ",
            },
          },
        },
      },
    ])
    .toArray();

  return NextResponse.json(rows);
}
