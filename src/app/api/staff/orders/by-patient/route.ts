/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";

const STAFF_ROLES = new Set(["admin", "assistant"]);

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = String((session?.user as any)?.role || "");

    if (!session?.user?.id || !STAFF_ROLES.has(role)) {
      return NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const url = new URL(req.url);
    const patientId = String(url.searchParams.get("patientId") || "").trim();

    if (!/^[a-f\d]{24}$/i.test(patientId)) {
      return NextResponse.json(
        { ok: false, error: "Invalid patient id." },
        { status: 400 }
      );
    }

    const db = await getDb();
    const orders = db.collection("orders");

    const docs = await orders
      .find(
        {
          userId: patientId,
          paymentMethod: "Pay on pickup",
          status: { $in: ["pending", "preparing", "ready"] },
        },
        {
          projection: {
            orderNumber: 1,
            userId: 1,
            userEmail: 1,
            status: 1,
            subtotal: 1,
            total: 1,
            paymentMethod: 1,
            rewardsDiscount: 1,
            pointsRedeemed: 1,
            createdAt: 1,
            items: 1,
          },
        }
      )
      .sort({ createdAt: -1, _id: -1 })
      .toArray();

    const items = docs.map((d: any) => ({
      id: String(d._id),
      orderNumber: String(d.orderNumber || ""),
      userId: String(d.userId || ""),
      userEmail: d.userEmail || null,
      status: String(d.status || "pending"),
      subtotal: Number(d.subtotal || 0),
      total: Number(d.total || 0),
      paymentMethod: String(d.paymentMethod || "Pay on pickup"),
      rewardsDiscount: Number(d.rewardsDiscount || 0),
      pointsRedeemed: Number(d.pointsRedeemed || 0),
      createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : null,
      items: Array.isArray(d.items)
        ? d.items.map((it: any) => ({
            name: String(it?.name || "Item"),
            qty: Number(it?.qty || 0),
          }))
        : [],
    }));

    return NextResponse.json({
      ok: true,
      items,
    });
  } catch (e) {
    console.error("GET /api/staff/orders/by-patient error:", e);
    return NextResponse.json(
      { ok: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}