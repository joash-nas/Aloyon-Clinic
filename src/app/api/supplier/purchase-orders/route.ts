// src/app/api/supplier/purchase-orders/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

const SECRET = process.env.NEXTAUTH_SECRET!;
const SUPPLIER_ROLES = new Set(["supplier", "admin"]);

function toOid(v?: string | null) {
  try {
    return v ? new ObjectId(v) : null;
  } catch {
    return null;
  }
}

// GET – list purchase orders for the logged-in supplier/admin
export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: SECRET });
  const role = String(token?.role || "");
  if (!SUPPLIER_ROLES.has(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = await getDb();

  const filter =
    role === "supplier"
      ? {
          supplierId: (() => {
            try {
              return new ObjectId(String(token?.sub));
            } catch {
              return String(token?.sub);
            }
          })(),
        }
      : {};

  const rows = await db
    .collection("purchase_orders")
    .find(filter, {
      projection: {
        _id: 1,
        poNumber: 1,
        dateIssued: 1,
        status: 1,
        invoiceUrl: 1,
        items: 1,
      },
      sort: { dateIssued: -1 },
    })
    .toArray();

  const data = rows.map((r: any) => {
    const itemsCount = Array.isArray(r.items) ? r.items.length : 0;
    const total = (Array.isArray(r.items) ? r.items : []).reduce(
      (a: number, it: any) => a + Number(it.qty || 0) * Number(it.price || 0),
      0
    );
    return {
      id: r._id.toString(),
      poNumber: r.poNumber,
      dateIssued: r.dateIssued,
      status: r.status,
      invoiceUrl: r.invoiceUrl ?? null,
      itemsCount,
      total,
    };
  });

  return NextResponse.json(data);
}

// PATCH – change status (supplier side)
// Supplier: only "Pending" | "Processing" | "Shipped"
// Admin: can also use "Delivered" | "Cancelled" if needed
export async function PATCH(req: NextRequest) {
  const token = await getToken({ req, secret: SECRET });
  const role = String(token?.role || "");
  if (!SUPPLIER_ROLES.has(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({} as any));
  const id = String(body.id || "");
  const nextStatus = String(body.status || "").trim();

  const _id = toOid(id);
  if (!_id) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  if (!nextStatus) {
    return NextResponse.json({ error: "Missing status" }, { status: 400 });
  }

  const allowedForSupplier = new Set(["Pending", "Processing", "Shipped"]);
  const allowedForAdmin = new Set([
    "Pending",
    "Processing",
    "Shipped",
    "Delivered",
    "Cancelled",
  ]);

  const allowed =
    role === "supplier" ? allowedForSupplier : allowedForAdmin;

  if (!allowed.has(nextStatus)) {
    return NextResponse.json(
      { error: "Invalid status for your role" },
      { status: 400 }
    );
  }

  const db = await getDb();

  const filter =
    role === "supplier"
      ? {
          _id,
          supplierId: (() => {
            try {
              return new ObjectId(String(token?.sub));
            } catch {
              return String(token?.sub);
            }
          })(),
        }
      : { _id };

  const current = await db
    .collection("purchase_orders")
    .findOne(filter, { projection: { status: 1 } });

  if (!current) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (String(current.status) === nextStatus) {
    return NextResponse.json({ id, status: nextStatus });
  }

  await db.collection("purchase_orders").updateOne(filter, {
    $set: { status: nextStatus, updatedAt: new Date() },
  });

  // NOTE: Expense sync for "Delivered" will now be done on the ASSISTANT side,

  return NextResponse.json({ id, status: nextStatus });
}
