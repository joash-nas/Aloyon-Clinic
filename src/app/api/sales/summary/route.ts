// src/app/api/sales/summary/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const dynamic = "force-dynamic";

type OrderDoc = {
  _id: any;
  status: string;
  total?: number;
  createdAt: Date;
};

export async function GET(_req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Optional: restrict to admin/sales roles
    // const role = (session.user as any).role;
    // if (!["ADMIN", "SALES", "admin", "sales"].includes(role)) {
    //   return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    // }

    const db = await getDb();
    const ordersCol = db.collection<OrderDoc>("orders");

    const now = new Date();

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const year = now.getFullYear();
    const month = now.getMonth();
    const monthStart = new Date(year, month, 1, 0, 0, 0, 0);
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);

    const todayFilter: any = {
      createdAt: { $gte: todayStart, $lte: todayEnd },
    };

    const monthFilter: any = {
      createdAt: { $gte: monthStart, $lte: monthEnd },
    };

    // ---- Today ------------------------------------------------------------
    const [
      todayNew,
      todayPending,
      todayCancelled,
      todayCompletedDocs,
    ] = await Promise.all([
      ordersCol.countDocuments(todayFilter),
      ordersCol.countDocuments({
        ...todayFilter,
        status: { $in: ["pending", "preparing", "ready"] },
      }),
      ordersCol.countDocuments({
        ...todayFilter,
        status: "cancelled",
      }),
      ordersCol
        .find({
          ...todayFilter,
          status: "completed",
        })
        .toArray(),
    ]);

    const completedOrdersToday = todayCompletedDocs.length;
    const revenueToday = todayCompletedDocs.reduce(
      (sum, o) => sum + (o.total ?? 0),
      0
    );
    const avgOrderValueToday =
      completedOrdersToday > 0 ? revenueToday / completedOrdersToday : 0;

    // ---- Month ------------------------------------------------------------
    const monthCompletedDocs = await ordersCol
      .find({
        ...monthFilter,
        status: "completed",
      })
      .toArray();

    const completedOrdersMonth = monthCompletedDocs.length;
    const revenueMonth = monthCompletedDocs.reduce(
      (sum, o) => sum + (o.total ?? 0),
      0
    );
    const avgOrderValueMonth =
      completedOrdersMonth > 0 ? revenueMonth / completedOrdersMonth : 0;

    return NextResponse.json({
      revenueToday,
      revenueMonth,
      completedOrdersToday,
      completedOrdersMonth,
      newOrdersToday: todayNew,
      pendingOrdersToday: todayPending,
      cancelledOrdersToday: todayCancelled,
      avgOrderValueToday,
      avgOrderValueMonth,
    });
  } catch (err) {
    console.error("[GET /api/sales/summary] error:", err);
    return NextResponse.json(
      { error: "Failed to load sales summary" },
      { status: 500 }
    );
  }
}
