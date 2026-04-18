import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
const SECRET = process.env.NEXTAUTH_SECRET!;

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const token = await getToken({ req, secret: SECRET });
  if (!token || !["admin", "doctor", "sales"].includes(String(token.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  let _id: ObjectId | null = null;
  try { _id = new ObjectId(id); } catch {}
  if (!_id) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const db = await getDb();
  await db.collection("sales").deleteOne({ _id });
  return NextResponse.json({ ok: true });
}
