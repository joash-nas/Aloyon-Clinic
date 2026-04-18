import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

const SECRET = process.env.NEXTAUTH_SECRET!;
const ALLOWED = new Set(["sales", "doctor", "admin"]);

const toOid = (v?: string | null) => { try { return v ? new ObjectId(v) : null; } catch { return null; } };

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const token = await getToken({ req, secret: SECRET });
  if (!token?.role || !ALLOWED.has(String(token.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const _id = toOid(id);
  if (!_id) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const $set: any = { updatedAt: new Date() };
  if (body.date) $set.date = new Date(body.date);
  if (body.category) $set.category = String(body.category);
  if (body.description !== undefined) $set.description = String(body.description);
  if (body.amount !== undefined) $set.amount = Number(body.amount);
  if (body.paymentMethod) $set.paymentMethod = String(body.paymentMethod);

  const db = await getDb();
  const res = await db.collection("expenses").updateOne({ _id }, { $set });
  if (!res.matchedCount) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const token = await getToken({ req, secret: SECRET });
  if (!token?.role || !ALLOWED.has(String(token.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const _id = toOid(id);
  if (!_id) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const db = await getDb();
  const res = await db.collection("expenses").deleteOne({ _id });
  if (!res.deletedCount) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
