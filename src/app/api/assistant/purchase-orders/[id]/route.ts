/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/assistant/purchase-orders/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const OK_ROLES = new Set(["assistant", "doctor", "admin"]);

function toOid(v?: string | null) {
  try {
    return v ? new ObjectId(v) : null;
  } catch {
    return null;
  }
}

/* get single PO details for staff */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;

  // only staff with a valid session
  if (!session?.user?.id || !role || !OK_ROLES.has(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const _id = toOid(id);
  if (!_id) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }

  const db = await getDb();

  // load purchase order
  const doc = await db.collection("purchase_orders").findOne(
    { _id },
    {
      projection: {
        _id: 1,
        poNumber: 1,
        dateIssued: 1,
        supplierEmail: 1,
        status: 1,
        notes: 1,
        invoiceUrl: 1,
        items: 1,
      },
    }
  );

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // compute item subtotals and total
  const items = Array.isArray(doc.items)
    ? (doc.items as any[]).map((it) => {
        const qty = Number(it.qty || 0);
        const price = Number(it.price || 0);
        const subtotal = qty * price;
        return {
          name: String(it.name || ""),
          qty,
          price,
          subtotal,
        };
      })
    : [];

  const total = items.reduce((a, it) => a + it.subtotal, 0);

  return NextResponse.json({
    id: doc._id.toString(),
    poNumber: doc.poNumber,
    dateIssued: doc.dateIssued,
    supplierEmail: doc.supplierEmail ?? null,
    status: doc.status ?? "Pending",
    notes: doc.notes ?? null,
    invoiceUrl: doc.invoiceUrl ?? null,
    items,
    total,
  });
}

/* update PO notes / cancel / mark as delivered */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;

  // only staff with a valid session
  if (!session?.user?.id || !role || !OK_ROLES.has(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const _id = toOid(id);
  if (!_id) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({} as any));
  const action = String(body.action || "");

  const db = await getDb();

  // load current PO state
  const po = await db.collection("purchase_orders").findOne(
    { _id },
    {
      projection: {
        _id: 1,
        poNumber: 1,
        dateIssued: 1,
        supplierEmail: 1,
        items: 1,
        status: 1,
        notes: 1,
        invoiceUrl: 1,
      },
    }
  );

  if (!po) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // update notes only
  if (action === "update_notes") {
    const notes = typeof body.notes === "string" ? body.notes : "";
    await db.collection("purchase_orders").updateOne(
      { _id },
      { $set: { notes, updatedAt: new Date() } }
    );
    return NextResponse.json({ id, notes });
  }

  // cancel PO and delete linked expense
  if (action === "cancel") {
    if (po.status === "Delivered") {
      return NextResponse.json(
        { error: "Delivered orders cannot be cancelled" },
        { status: 400 }
      );
    }

    await db.collection("purchase_orders").updateOne(
      { _id },
      { $set: { status: "Cancelled", updatedAt: new Date() } }
    );

    const expenseMatch = {
      $or: [{ linkedPoId: _id }, { poNumber: po.poNumber }],
    };
    await db.collection("expenses").deleteOne(expenseMatch);

    return NextResponse.json({ id, status: "Cancelled" });
  }

  // mark delivered and sync expense
  if (action === "mark_delivered") {
    if (po.status === "Cancelled") {
      return NextResponse.json(
        { error: "Cancelled order cannot be delivered" },
        { status: 400 }
      );
    }

    await db.collection("purchase_orders").updateOne(
      { _id },
      { $set: { status: "Delivered", updatedAt: new Date() } }
    );

    const expenseMatch = {
      $or: [{ linkedPoId: _id }, { poNumber: po.poNumber }],
    };

    const items: Array<{ qty: number; price: number }> = Array.isArray(po.items)
      ? (po.items as any[])
      : [];
    const total = items.reduce(
      (a, it: any) => a + Number(it.qty || 0) * Number(it.price || 0),
      0
    );

    const description =
      `Purchase order ${po.poNumber}` +
      (po.supplierEmail ? ` to ${po.supplierEmail}` : "");

    await db.collection("expenses").updateOne(
      expenseMatch,
      {
        $set: {
          date: po.dateIssued || new Date(),
          category: "Supplies",
          description,
          amount: total,
          paymentMethod: "Bank",
          receiptUrl: null,
          updatedAt: new Date(),
          supplierEmail: po.supplierEmail ?? null,
          poNumber: po.poNumber,
          linkedPoId: _id,
        },
        $setOnInsert: {
          createdBy: "assistant-sync",
        },
      },
      { upsert: true }
    );

    return NextResponse.json({
      id,
      status: "Delivered",
      invoiceUrl: po.invoiceUrl ?? null,
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
