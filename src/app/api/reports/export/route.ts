import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getDb } from "@/lib/mongodb";

const SECRET = process.env.NEXTAUTH_SECRET!;
const OK = new Set(["admin", "doctor", "sales"]);

function esc(s: any) {
  const q = String(s ?? "").replace(/"/g, '""');
  return /[",\n]/.test(q) ? `"${q}"` : q;
}

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: SECRET });
  if (!token || !OK.has(String(token.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const kind = (searchParams.get("kind") || "sales") as "sales" | "expenses";
  const fromStr = searchParams.get("from") || "";
  const toStr = searchParams.get("to") || "";

  const from = fromStr ? new Date(fromStr + "T00:00:00.000Z") : null;
  const to = toStr ? new Date(toStr + "T23:59:59.999Z") : null;

  const db = await getDb();
  const where: any = {};
  if (from || to) {
    where.date = {};
    if (from) where.date.$gte = from;
    if (to) where.date.$lte = to;
  }

  const rows = await db.collection(kind)
    .find(where, { sort: { date: -1, _id: -1 } })
    .toArray();

  const header = ["Date", "Category", "Description", "Amount", "Method"].join(",");
  const lines = rows.map((r: any) =>
    [
      new Date(r.date).toISOString().slice(0, 10),
      esc(r.category),
      esc(r.description),
      r.amount,
      esc(r.paymentMethod),
    ].join(",")
  );

  const csv = [header, ...lines].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${kind}-report.csv"`,
    },
  });
}
