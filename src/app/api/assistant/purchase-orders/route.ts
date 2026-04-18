/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/assistant/purchase-orders/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

type Item = { productId?: string; name: string; qty: number; price: number };

/* create purchase order for assistant/doctor/admin */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;

  // only staff can create POs
  if (!session?.user?.id || !role || !["admin", "doctor", "assistant"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const supplierIdRaw: string | undefined = body?.supplierId;
  const items: Item[] = Array.isArray(body?.items) ? body.items : [];
  const notes: string | undefined = body?.notes || undefined;

  // require supplier and at least one item
  if (!supplierIdRaw || items.length === 0) {
    return NextResponse.json(
      { error: "supplierId and at least one item are required" },
      { status: 400 }
    );
  }

  let supplierId: ObjectId | string = supplierIdRaw;
  let supplierIdObj: ObjectId | null = null;
  try {
    supplierIdObj = new ObjectId(supplierIdRaw);
    supplierId = supplierIdObj;
  } catch {
    // keep as string
  }

  // createdBy as ObjectId or string
  let createdBy: ObjectId | string | null = null;
  try {
    createdBy = new ObjectId(String(session.user.id));
  } catch {
    createdBy = String(session.user.id);
  }

  // normalize items and drop invalid rows
  const cleanItems = items
    .map((i) => ({
      productId: (() => {
        try {
          return i.productId ? new ObjectId(i.productId) : undefined;
        } catch {
          return undefined;
        }
      })(),
      name: String(i.name || "").trim(),
      qty: Number(i.qty),
      price: Number(i.price),
    }))
    .filter((i) => i.name && i.qty > 0 && i.price >= 0);

  if (cleanItems.length === 0) {
    return NextResponse.json(
      { error: "All items are invalid—please provide valid name/qty/price." },
      { status: 400 }
    );
  }

  const db = await getDb();

  // look up supplier email when not passed from UI
  let supplierEmail: string | null = body?.supplierEmail ?? null;

  if (!supplierEmail) {
    const users = db.collection<{
      _id: ObjectId;
      email: string;
      role: string;
    }>("users");

    let supplierDoc: { _id: ObjectId; email: string; role: string } | null =
      null;

    if (supplierIdObj) {
      supplierDoc = await users.findOne(
        { _id: supplierIdObj, role: "supplier" as const },
        { projection: { email: 1 } }
      );
    } else if (typeof supplierId === "string") {
      try {
        const asOid = new ObjectId(supplierId);
        supplierDoc = await users.findOne(
          { _id: asOid, role: "supplier" as const },
          { projection: { email: 1 } }
        );
      } catch {
        supplierDoc = await users.findOne(
          { email: supplierId, role: "supplier" as const },
          { projection: { email: 1 } }
        );
      }
    }

    supplierEmail = supplierDoc?.email ?? null;
  }

  const poNumber = body?.poNumber || `PO-${Date.now()}`;
  const dateIssued = new Date();

  const doc = {
    poNumber,
    dateIssued,
    supplierId,
    supplierEmail,
    createdBy,
    status: "Pending" as const,
    items: cleanItems,
    notes: notes ?? null,
    invoiceUrl: null as string | null,
    updatedAt: new Date(),
  };

  // create purchase order
  const poRes = await db.collection("purchase_orders").insertOne(doc as any);

  // auto-create expense record for supplies
  const total = cleanItems.reduce((a, i) => a + i.qty * i.price, 0);
  const linkedPoId = poRes.insertedId;

  const existing = await db.collection("expenses").findOne({
    $or: [{ linkedPoId }, { poNumber }],
  });

  if (!existing) {
    const expenseDoc = {
      date: dateIssued,
      category: "Supplies",
      description: `Purchase order ${poNumber}${
        supplierEmail ? ` to ${supplierEmail}` : ""
      }`,
      amount: total,
      paymentMethod: "Bank",
      receiptUrl: null as string | null,
      createdBy,
      updatedAt: new Date(),
      linkedPoId,
      poNumber,
      supplierEmail,
    };
    await db.collection("expenses").insertOne(expenseDoc as any);
  }

  return NextResponse.json({
    ok: true,
    id: poRes.insertedId.toString(),
    poNumber,
  });
}

/* list purchase orders for staff, with filters */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;

  // only staff can list POs
  if (!session?.user?.id || !role || !["admin", "doctor", "assistant"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const status = url.searchParams.get("status") || "";
  const mine = url.searchParams.get("mine") === "true";

  const db = await getDb();
  const match: any = {};

  // optional status filter
  const allowedStatuses = new Set([
    "Pending",
    "Processing",
    "Shipped",
    "Delivered",
    "Cancelled",
  ]);
  if (status && allowedStatuses.has(status)) {
    match.status = status;
  }

  // optional "my POs only" filter
  if (mine && session.user.id) {
    try {
      match.createdBy = new ObjectId(String(session.user.id));
    } catch {
      match.createdBy = String(session.user.id);
    }
  }

  // optional search by PO number or supplier email
  if (q) {
    match.$or = [
      { poNumber: { $regex: q, $options: "i" } },
      { supplierEmail: { $regex: q, $options: "i" } },
    ];
  }

  // aggregate with computed count and total
  const rows = await db
    .collection("purchase_orders")
    .aggregate([
      { $match: match },
      { $sort: { dateIssued: -1 } },
      {
        $project: {
          _id: 0,
          id: { $toString: "$_id" },
          poNumber: 1,
          dateIssued: 1,
          status: 1,
          supplierEmail: 1,
          itemsCount: { $size: { $ifNull: ["$items", []] } },
          total: {
            $sum: {
              $map: {
                input: { $ifNull: ["$items", []] },
                as: "it",
                in: { $multiply: ["$$it.qty", "$$it.price"] },
              },
            },
          },
        },
      },
    ])
    .toArray();

  return NextResponse.json(rows);
}
