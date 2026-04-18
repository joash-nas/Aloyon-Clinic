/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redeemPoints } from "@/lib/rewards";

const STAFF_ROLES = new Set(["assistant", "staff", "admin", "doctor"]);

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const role = String((session.user as any).role || "");
    if (!STAFF_ROLES.has(role)) {
      return NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const body = await req.json();

    const patientId = String(body?.patientId || "").trim();
    const points = Math.floor(Number(body?.points || 0));
    const subtotalPhp =
      body?.subtotalPhp === "" || body?.subtotalPhp == null
        ? undefined
        : Number(body?.subtotalPhp);

    const sourceType =
      body?.sourceType === "order" ||
      body?.sourceType === "appointment" ||
      body?.sourceType === "manual" ||
      body?.sourceType === "redeem"
        ? body.sourceType
        : "redeem";

    const sourceId =
      typeof body?.sourceId === "string" && body.sourceId.trim()
        ? body.sourceId.trim()
        : undefined;

    const note =
      typeof body?.note === "string" && body.note.trim()
        ? body.note.trim()
        : undefined;

    const out = await redeemPoints({
      patientId,
      staffId: String(session.user.id),
      points,
      subtotalPhp,
      sourceType,
      sourceId,
      note,
    });

    return NextResponse.json(out);
  } catch (e: any) {
    console.error("POST /api/staff/rewards/redeem error:", e);

    return NextResponse.json(
      {
        ok: false,
        error: e?.message || "Failed to redeem points.",
      },
      { status: 400 }
    );
  }
}