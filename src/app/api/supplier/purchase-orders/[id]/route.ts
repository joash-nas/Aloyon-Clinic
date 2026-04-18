/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/supplier/purchase-orders/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

const SECRET = process.env.NEXTAUTH_SECRET!;
const SUPPLIER_ROLES = new Set(["supplier", "admin"]); // admin can assist

function toOid(v?: string | null) {
  try { return v ? new ObjectId(v) : null; } catch { return null; }
}

/* ------------------------------------------------------------------ */
/* GET /api/supplier/purchase-orders/[id]                              */
/*  - Returns a single PO that belongs to the logged-in supplier       */
/*  - Next 15: unwrap params (Promise)                                 */
/* ------------------------------------------------------------------ */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const token = await getToken({ req, secret: SECRET });
  const role = String(token?.role || "");
  if (!SUPPLIER_ROLES.has(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;          // <- unwrap Promise
  const _id = toOid(id);
  if (!_id) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const db = await getDb();

  // Only allow suppliers to see their own POs. Admin can view any.
  const supplierId = toOid(String(token?.sub));
  const filter =
    role === "supplier" ? { _id, supplierId } : { _id };

  const doc = await db.collection("purchase_orders").findOne(filter);
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Normalize items for UI
  const items = (Array.isArray(doc.items) ? doc.items : []).map((it: any) => {
    const qty = Number(it?.qty ?? 0);
    const price = Number(it?.price ?? 0);
    return {
      name: String(it?.name ?? ""),
      qty,
      price,
      subtotal: qty * price,
    };
  });

  const total = items.reduce((s: number, it: any) => s + Number(it.subtotal || 0), 0);

  return NextResponse.json({
    id: String(doc._id),
    poNumber: String(doc.poNumber ?? ""),
    dateIssued:
      doc.dateIssued instanceof Date
        ? doc.dateIssued.toISOString()
        : String(doc.dateIssued ?? ""),
    status: String(doc.status ?? "Pending") as
      | "Pending" | "Processing" | "Shipped" | "Delivered" | "Cancelled",
    notes: doc.notes ?? null,
    invoiceUrl: doc.invoiceUrl ?? null,
    items,
    total,
  });
}

/* ------------------------------------------------------------------ */
/* PATCH /api/supplier/purchase-orders/[id]                            */
/*  - Update status; sync “Supplies” expense on Delivered              */
/* ------------------------------------------------------------------ */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  // --- auth ---
  const token = await getToken({ req, secret: SECRET });
  const role = String(token?.role || "");
  if (!SUPPLIER_ROLES.has(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const _id = toOid(id);
  if (!_id) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const nextStatus = String(body?.status || "").trim(); // "Processing" | "Shipped" | "Delivered" | "Cancelled"
  if (!nextStatus) return NextResponse.json({ error: "Missing status" }, { status: 400 });

  const db = await getDb();

  // Load PO (ensure supplier owns it unless admin)
  const supplierFilter =
    role === "supplier"
      ? { supplierId: (() => { const oid = toOid(String(token?.sub)); return oid ?? String(token?.sub); })() }
      : {};

  const po = await db.collection("purchase_orders").findOne(
    { _id, ...supplierFilter },
    { projection: { items: 1, status: 1, poNumber: 1, supplierEmail: 1, dateIssued: 1 } }
  );

  if (!po) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allowed = new Set(["Pending", "Processing", "Shipped", "Delivered", "Cancelled"]);
  if (!allowed.has(nextStatus)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  // Block no-op only
  if (String(po.status) === nextStatus) {
    return NextResponse.json({ id, status: nextStatus });
  }

  // Update PO status
  await db.collection("purchase_orders").updateOne(
    { _id },
    { $set: { status: nextStatus, updatedAt: new Date() } }
  );

  // -------- Expense sync logic --------
  const expenseMatch = { $or: [{ linkedPoId: _id }, { poNumber: po.poNumber }] };

  if (nextStatus === "Delivered") {
    // Compute total
    const items: Array<{ qty: number; price: number }> = Array.isArray(po.items) ? po.items : [];
    const total = items.reduce(
      (a, it: any) => a + Number(it.qty || 0) * Number(it.price || 0), 0
    );

    // Upsert expense (idempotent)
    const description =
      `Purchase order ${po.poNumber}` + (po.supplierEmail ? ` to ${po.supplierEmail}` : "");

    await db.collection("expenses").updateOne(
      expenseMatch,
      {
        $set: {
          date: po.dateIssued || new Date(),
          category: "Supplies",
          description,
          amount: total,
          paymentMethod: "Bank", // adjust if needed
          receiptUrl: null,
          updatedAt: new Date(),
          supplierEmail: po.supplierEmail ?? null,
          poNumber: po.poNumber,
          linkedPoId: _id,
        },
        $setOnInsert: {
          createdBy: "system-sync",
        },
      },
      { upsert: true }
    );
  } else {
    // If moving away from Delivered OR cancelling, remove the expense
    await db.collection("expenses").deleteOne(expenseMatch);
  }
  // -------- /Expense sync logic --------

  return NextResponse.json({ id, status: nextStatus });
}
