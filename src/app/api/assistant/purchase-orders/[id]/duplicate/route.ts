/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/assistant/purchase-orders/[id]/duplicate/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

const SECRET = process.env.NEXTAUTH_SECRET!;

const toOid = (v?: string | null) => {
  try {
    return v ? new ObjectId(v) : null;
  } catch {
    return null;
  }
};

/* duplicate an existing purchase order for assistant/doctor/admin */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const token = await getToken({ req, secret: SECRET });
  const role = token?.role as string | undefined;

  // only staff can duplicate POs
  if (!role || !["admin", "doctor", "assistant"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const _id = toOid(id);
  if (!_id) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }

  const db = await getDb();

  // load source PO
  const src = await db.collection("purchase_orders").findOne({ _id });
  if (!src) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // set createdBy to current user
  let createdBy: ObjectId | string | null = null;
  try {
    createdBy = new ObjectId(String(token?.sub));
  } catch {
    createdBy = String(token?.sub || "");
  }

  // new PO copy
  const copy = {
    poNumber: `PO-${Date.now()}`,
    dateIssued: new Date(),
    supplierId: src.supplierId,
    supplierEmail: src.supplierEmail ?? null,
    createdBy,
    status: "Pending" as const,
    items: (src.items ?? []).map((it: any) => ({
      productId: it.productId
        ? (() => {
            try {
              return new ObjectId(String(it.productId));
            } catch {
              return String(it.productId);
            }
          })()
        : undefined,
      name: String(it.name),
      qty: Number(it.qty),
      price: Number(it.price),
    })),
    notes: src.notes ?? null,
    invoiceUrl: null as string | null,
    updatedAt: new Date(),
  };

  const res = await db.collection("purchase_orders").insertOne(copy as any);

  return NextResponse.json({
    ok: true,
    id: res.insertedId.toString(),
    poNumber: copy.poNumber,
  });
}
