/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/staff/orders/route.ts

import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const dynamic = "force-dynamic";

type Status = "pending" | "preparing" | "ready" | "completed" | "cancelled";

function isStaffRole(role?: string | null) {
  const r = String(role || "").toLowerCase();
  return r === "admin" || r === "assistant" || r === "sales";
}

function safeStatus(x: any): Status | "all" {
  const v = String(x || "").toLowerCase();
  if (v === "all") return "all";
  if (v === "pending") return "pending";
  if (v === "preparing") return "preparing";
  if (v === "ready") return "ready";
  if (v === "completed") return "completed";
  if (v === "cancelled") return "cancelled";
  return "all";
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    const role =
      (session?.user as any)?.role ||
      (session?.user as any)?.userRole ||
      null;

    if (!session?.user?.id || !isStaffRole(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const limit = Math.min(
      50,
      Math.max(1, Number(url.searchParams.get("limit") || 8))
    );
    const status = safeStatus(url.searchParams.get("status"));

    const db = await getDb();
    const col = db.collection("orders") as any;

    const filter: any = {};
    if (status !== "all") filter.status = status;

    const total = await col.countDocuments(filter);

    const docs = await col
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    const items = docs.map((d: any) => {
      const method = d.paymentMethod || "Pay on pickup";

      // correct paid logic (PayMongo webhook sets payment.state = "paid")
      const paid =
        String(d?.payment?.state || "").toLowerCase() === "paid" ||
        d.status === "completed";

      const readyEmailSentAt =
        d?.notifications?.readyEmailSentAt
          ? new Date(d.notifications.readyEmailSentAt).toISOString()
          : null;

      return {
        id: d._id.toString(),
        orderNumber: d.orderNumber,
        userEmail: d.userEmail || d.user?.email || "—",
        status: d.status as Status,
        subtotal: Number(d.subtotal || 0),
        total: Number(d.total || 0),
        createdAt: d.createdAt
          ? new Date(d.createdAt).toISOString()
          : new Date().toISOString(),
        paymentMethod: method,
        paid,

        readyEmailSentAt,

        items: (d.items || []).map((it: any) => ({
          name: String(it.name || "Item"),
          qty: Number(it.qty || 1),
        })),
      };
    });

    return NextResponse.json({ items, total, page, limit });
  } catch (e: any) {
    console.error("[GET /api/staff/orders] error:", e);
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}