/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  getRedeemQuote,
  pesoFromPoints,
} from "@/lib/rewards";

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
    if (role !== "patient") {
      return NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const body = await req.json();

    const subtotalPhp = Number(body?.subtotalPhp || 0);
    const requestedPoints = Math.floor(Number(body?.pointsToUse || 0));

    if (!Number.isFinite(subtotalPhp) || subtotalPhp <= 0) {
      return NextResponse.json(
        { ok: false, error: "Invalid subtotal." },
        { status: 400 }
      );
    }

    const quote = await getRedeemQuote({
      patientId: String(session.user.id),
      subtotalPhp,
    });

    let appliedPoints = 0;

    if (requestedPoints > 0) {
      appliedPoints = Math.min(requestedPoints, quote.maxRedeemPoints);
    }

    const discountPhp = pesoFromPoints(appliedPoints);
    const newTotal = Math.max(0, subtotalPhp - discountPhp);

    return NextResponse.json({
      ok: true,
      subtotalPhp,
      availablePoints: quote.availablePoints,
      availablePesoValue: quote.availablePesoValue,
      minRedeemPoints: quote.minRedeemPoints,
      maxRedeemPoints: quote.maxRedeemPoints,
      maxDiscountPhp: quote.maxDiscountPhp,
      appliedPoints,
      discountPhp,
      newTotal,
    });
  } catch (e) {
    console.error("POST /api/checkout/apply-points error:", e);
    return NextResponse.json(
      { ok: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}