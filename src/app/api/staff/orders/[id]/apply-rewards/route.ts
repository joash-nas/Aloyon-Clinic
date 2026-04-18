//src/app/api/staff/orders/[id]/apply-rewards/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { awardPoints, redeemPoints } from "@/lib/rewards";

const STAFF_ROLES = new Set(["admin", "assistant"]);

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const role = String((session?.user as any)?.role || "");

    if (!session?.user?.id || !STAFF_ROLES.has(role)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await ctx.params;
    if (!/^[a-f\d]{24}$/i.test(id)) {
      return NextResponse.json({ ok: false, error: "Invalid order id." }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const patientId = String(body?.patientId || "").trim();
    const points = Math.floor(Number(body?.points || 0));

    if (!/^[a-f\d]{24}$/i.test(patientId)) {
      return NextResponse.json({ ok: false, error: "Invalid patient id." }, { status: 400 });
    }

    if (!Number.isFinite(points) || points <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid points." }, { status: 400 });
    }

    const db = await getDb();
    const orders = db.collection("orders");
    const _id = new ObjectId(id);

    const order = await orders.findOne({ _id });
    if (!order) {
      return NextResponse.json({ ok: false, error: "Order not found." }, { status: 404 });
    }

    const paymentMethod = String((order as any).paymentMethod || "Pay on pickup");
    const status = String((order as any).status || "pending");

    if (paymentMethod !== "Pay on pickup") {
      return NextResponse.json(
        { ok: false, error: "QR redemption is only for pay-on-pickup orders." },
        { status: 400 }
      );
    }

    if (status === "completed" || status === "cancelled") {
      return NextResponse.json(
        { ok: false, error: "This order is locked." },
        { status: 400 }
      );
    }

    const existingPointsRedeemed = Number((order as any).pointsRedeemed || 0);
    const existingRewardsDiscount = Number((order as any).rewardsDiscount || 0);

    if (existingPointsRedeemed > 0 || existingRewardsDiscount > 0) {
      return NextResponse.json(
        { ok: false, error: "Rewards already applied to this order." },
        { status: 400 }
      );
    }

    const orderPatientId = String((order as any).userId || "");
    if (orderPatientId !== patientId) {
      return NextResponse.json(
        { ok: false, error: "Scanned patient does not match this pickup order." },
        { status: 400 }
      );
    }

    const subtotalPhp = Number((order as any).subtotal || 0);

    const redeemOut = await redeemPoints({
      patientId,
      staffId: String(session.user.id),
      points,
      subtotalPhp,
      sourceType: "order",
      sourceId: id,
      note: `Redeemed at pickup for ${(order as any).orderNumber || id}`,
    });

    const discountPhp = Number(redeemOut.discountPhp || 0);
    const newTotal = Math.max(0, subtotalPhp - discountPhp);

    const orderUpdate: any = {
    $set: {
        rewardsDiscount: discountPhp,
        pointsRedeemed: Number(redeemOut.redeemedPoints || points),
        total: newTotal,
        updatedAt: new Date(),
    },
    $push: {
        rewardsHistory: {
        type: "redeem",
        points: Number(redeemOut.redeemedPoints || points),
        amount: discountPhp,
        at: new Date(),
        byRole: role,
        byUserId: String(session.user.id),
        },
    },
    };

    const updateRes = await orders.updateOne({ _id }, orderUpdate);

    if (!updateRes.matchedCount) {
      try {
        await awardPoints({
          patientId,
          staffId: String(session.user.id),
          activity: "manual",
          points: Number(redeemOut.redeemedPoints || points),
          sourceType: "manual",
          sourceId: `rollback:${id}:${Date.now()}`,
          note: `Rollback for failed pickup reward application on order ${id}`,
        });
      } catch (rollbackErr) {
        console.error("Rollback award failed:", rollbackErr);
      }

      return NextResponse.json(
        { ok: false, error: "Failed to update order after redeem." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      redeemedPoints: Number(redeemOut.redeemedPoints || points),
      rewardsDiscount: discountPhp,
      newOrderTotal: newTotal,
      newBalancePoints: Number(redeemOut.newBalancePoints || 0),
    });
  } catch (e: any) {
    console.error("POST /api/staff/orders/[id]/apply-rewards error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to apply rewards." },
      { status: 400 }
    );
  }
}