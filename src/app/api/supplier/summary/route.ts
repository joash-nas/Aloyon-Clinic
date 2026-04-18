// src/app/api/supplier/summary/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

const SECRET = process.env.NEXTAUTH_SECRET!;
const SUPPLIER_ROLES = new Set(["supplier", "admin"]);

type PoDoc = {
  _id: any;
  supplierId?: any;
  supplierEmail?: string | null;
  status: string;
  total?: number;
  poNumber?: string;
  createdAt?: Date;
  dateIssued?: Date;
};

function resolveSupplierId(token: any): any {
  // same as /api/supplier/purchase-orders
  try {
    return new ObjectId(String(token?.sub));
  } catch {
    return String(token?.sub);
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req, secret: SECRET });
    const role = String(token?.role || "");

    if (!SUPPLIER_ROLES.has(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = await getDb();
    const poCol = db.collection<PoDoc>("purchase_orders");

    // For suppliers: ONLY their own POs (by supplierId)
    // For admin: can see all suppliers' POs
    const baseFilter =
      role === "supplier"
        ? { supplierId: resolveSupplierId(token) }
        : {};

    const statusPending = ["Pending", "pending"];
    const statusProcessing = ["Processing", "processing", "In Progress", "in progress"];
    const statusShipped = ["Shipped", "shipped"];
    const statusDelivered = ["Delivered", "delivered"];
    const openStatuses = [
      ...statusPending,
      ...statusProcessing,
      ...statusShipped,
    ];

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const [
      pendingCount,
      processingCount,
      shippedCount,
      openCount,
      deliveredLast30Docs,
      recentDocs,
    ] = await Promise.all([
      poCol.countDocuments({
        ...baseFilter,
        status: { $in: statusPending },
      }),
      poCol.countDocuments({
        ...baseFilter,
        status: { $in: statusProcessing },
      }),
      poCol.countDocuments({
        ...baseFilter,
        status: { $in: statusShipped },
      }),
      poCol.countDocuments({
        ...baseFilter,
        status: { $in: openStatuses },
      }),
      poCol
        .find({
          ...baseFilter,
          status: { $in: statusDelivered },
          $or: [
            { dateIssued: { $gte: thirtyDaysAgo } },
            { createdAt: { $gte: thirtyDaysAgo } },
          ],
        })
        .toArray(),
      poCol
        .find(baseFilter)
        .sort({ dateIssued: -1, createdAt: -1, _id: -1 })
        .limit(5)
        .toArray(),
    ]);

    const deliveredLast30Days = deliveredLast30Docs.length;

    const recentOrders = recentDocs.map((o) => {
      const created =
        o.dateIssued instanceof Date
          ? o.dateIssued
          : o.createdAt instanceof Date
          ? o.createdAt
          : new Date();

      return {
        id: String(o._id),
        poNumber: o.poNumber ?? "—",
        createdAt: created.toISOString(),
        status: o.status,
        total: o.total ?? 0,
      };
    });

    return NextResponse.json({
      totalOpen: openCount,
      pending: pendingCount,
      processing: processingCount,
      shipped: shippedCount,
      deliveredLast30Days,
      recentOrders,
    });
  } catch (err) {
    console.error("[GET /api/supplier/summary] error:", err);
    return NextResponse.json(
      { error: "Failed to load supplier summary" },
      { status: 500 }
    );
  }
}
