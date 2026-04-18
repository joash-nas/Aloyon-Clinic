/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/orders/[id]/route.ts

import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { ObjectId } from "mongodb";

function isValidObjectId(id: string) {
  return /^[a-f\d]{24}$/i.test(id);
}

export async function GET(req: Request, ctx: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await ctx.params;
    if (!id || !isValidObjectId(id)) {
      return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
    }

    const db = await getDb();
    const ordersCol = db.collection("orders") as any;

    const order = await ordersCol.findOne({ _id: new ObjectId(id) });
    if (!order) {
      return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
    }

    // Only owner can view
    if (String(order.userId) !== String(session.user.id)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      ok: true,
      order: {
        id: order._id.toString(),
        orderNumber: order.orderNumber,
        status: order.status,
        total: order.total,
        payment: {
          state: order.payment?.state || "unpaid",
          paidAt: order.payment?.paidAt ? new Date(order.payment.paidAt).toISOString() : null,
        },
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}