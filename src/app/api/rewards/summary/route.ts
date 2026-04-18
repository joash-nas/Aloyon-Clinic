/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/rewards/summary/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getRewardsSummary } from "@/lib/rewards";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user as any).role as string | undefined;
    if (role !== "patient") {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const out = await getRewardsSummary(String(session.user.id));
    return NextResponse.json(out);
  } catch (e) {
    console.error("GET /api/rewards/summary error:", e);
    return NextResponse.json({ ok: false, error: "Internal Server Error" }, { status: 500 });
  }
}