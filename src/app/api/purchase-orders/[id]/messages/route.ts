/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/purchase-orders/[id]/messages/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const STAFF_ROLES = new Set(["assistant", "doctor", "admin"]);
const SUPPLIER_ROLES = new Set(["supplier"]);

function toOid(v?: string | null) {
  try {
    return v ? new ObjectId(v) : null;
  } catch {
    return null;
  }
}

/* GET: list messages for a PO */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  const userId = session?.user?.id as string | undefined;

  // must be logged in and either staff or supplier
  if (!userId || (!STAFF_ROLES.has(role ?? "") && !SUPPLIER_ROLES.has(role ?? ""))) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const poId = toOid(id);
  if (!poId) {
    return NextResponse.json({ ok: false, error: "Bad id" }, { status: 400 });
  }

  const db = await getDb();

  // Ensure the PO belongs to this supplier if role is supplier
  if (SUPPLIER_ROLES.has(role ?? "")) {
    const supplierId = toOid(userId) ?? userId;
    const po = await db.collection("purchase_orders").findOne(
      { _id: poId, supplierId },
      { projection: { _id: 1 } }
    );
    if (!po) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }
  }

  const rows = await db
    .collection("purchase_order_messages")
    .find({ poId }, { sort: { createdAt: 1 } })
    .toArray();

  const items = rows.map((m: any) => ({
    id: m._id.toString(),
    fromRole: m.fromRole as string,
    text: String(m.text ?? ""),
    createdAt:
      m.createdAt instanceof Date
        ? m.createdAt.toISOString()
        : String(m.createdAt),
  }));

  return NextResponse.json({ ok: true, items });
}

/* POST: add new message */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  const userId = session?.user?.id as string | undefined;

  if (!userId || (!STAFF_ROLES.has(role ?? "") && !SUPPLIER_ROLES.has(role ?? ""))) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const poId = toOid(id);
  if (!poId) {
    return NextResponse.json({ ok: false, error: "Bad id" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({} as any));
  const text = String(body.text || "").trim();
  if (!text) {
    return NextResponse.json(
      { ok: false, error: "Message required" },
      { status: 400 }
    );
  }

  const db = await getDb();

  // Ensure the PO belongs to this supplier if role is supplier
  if (SUPPLIER_ROLES.has(role ?? "")) {
    const supplierId = toOid(userId) ?? userId;
    const po = await db.collection("purchase_orders").findOne(
      { _id: poId, supplierId },
      { projection: { _id: 1 } }
    );
    if (!po) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }
  }

  const fromUserId = toOid(userId) ?? userId;

  const doc = {
    poId,
    fromUserId,
    fromRole: role ?? "unknown",
    text,
    createdAt: new Date(),
  };

  const r = await db.collection("purchase_order_messages").insertOne(doc);

  return NextResponse.json({
    ok: true,
    message: {
      id: r.insertedId.toString(),
      fromRole: doc.fromRole,
      text: doc.text,
      createdAt: doc.createdAt.toISOString(),
    },
  });
}
