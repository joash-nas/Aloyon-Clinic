/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getDb } from "@/lib/mongodb";

const SECRET = process.env.NEXTAUTH_SECRET!;

function csvEscape(s: string) {
  if (s == null) return "";
  const q = String(s).replace(/"/g, '""');
  return /[",\n]/.test(q) ? `"${q}"` : q;
}

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: SECRET });
  if (!token || !["admin", "doctor", "sales"].includes(String(token.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  const category = (searchParams.get("category") || "").trim();
  const method = (searchParams.get("method") || "").trim();

  const db = await getDb();
  const where: any = {};
  if (from || to) {
    where.date = {};
    if (from) where.date.$gte = new Date(new Date(from).setHours(0, 0, 0, 0));
    if (to) where.date.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
  }
  if (category) where.category = category;
  if (method) where.paymentMethod = method;
  if (q) where.$text = { $search: q };

  const rows = await db
    .collection("sales")
    .find(where, { sort: { date: -1, _id: -1 } })
    .toArray();

  const header = ["Date", "Category", "Description", "Amount", "Method"].join(",");
  const lines = rows.map((r: any) =>
    [
      new Date(r.date).toISOString().slice(0, 10),
      csvEscape(r.category),
      csvEscape(r.description),
      r.amount,
      csvEscape(r.paymentMethod),
    ].join(",")
  );

  const csv = [header, ...lines].join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sales-export.csv"`,
    },
  });
}
