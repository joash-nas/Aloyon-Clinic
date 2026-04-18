import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

const SECRET = process.env.NEXTAUTH_SECRET!;
const ALLOWED = new Set(["sales", "doctor", "admin"]);
const categories = new Set(["Supplies", "Utilities", "Salary", "Rent", "Maintenance", "Other"]);
const methods = new Set(["Cash", "GCash", "Bank"]);

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: SECRET });
  if (!token?.role || !ALLOWED.has(String(token.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const date = body?.date ? new Date(body.date) : new Date();
  const category = categories.has(String(body?.category)) ? String(body.category) : "Other";
  const description = String(body?.description ?? "").trim();
  const amount = Number(body?.amount);
  const paymentMethod = methods.has(String(body?.paymentMethod)) ? String(body.paymentMethod) : "Cash";

  if (!description || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Description and positive amount are required" }, { status: 400 });
  }

  let createdBy: ObjectId | string = String(token.sub || "");
  try { createdBy = new ObjectId(String(token.sub)); } catch {}

  const db = await getDb();
  const doc = {
    date,
    category,
    description,
    amount,
    paymentMethod,
    receiptUrl: null as string | null,
    createdBy,
    updatedAt: new Date(),
  };

  const res = await db.collection("expenses").insertOne(doc as any);
  return NextResponse.json({ id: res.insertedId.toString() });
}

// GET with filters: ?from=YYYY-MM-DD&to=YYYY-MM-DD&q=term&category=Category&method=Cash|GCash|Bank
export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: SECRET });
  if (!token?.role || !ALLOWED.has(String(token.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");
  const q = (url.searchParams.get("q") || "").trim();
  const category = url.searchParams.get("category") || "";
  const method = url.searchParams.get("method") || "";

  const match: any = {};
  if (fromStr || toStr) {
    match.date = {};
    if (fromStr) match.date.$gte = new Date(fromStr);
    if (toStr)   match.date.$lte = new Date(toStr + "T23:59:59.999Z");
  }
  if (q) match.description = { $regex: q, $options: "i" };
  if (category && categories.has(category)) match.category = category;
  if (method && methods.has(method)) match.paymentMethod = method;

  const db = await getDb();
  const rows = await db.collection("expenses")
    .aggregate([
      { $match: match },
      { $sort: { date: -1, _id: -1 } },
      {
        $project: {
          _id: 0,
          id: { $toString: "$_id" },
          date: 1,
          category: 1,
          description: 1,
          amount: 1,
          paymentMethod: 1,
        }
      }
    ])
    .toArray();

  // summary for quick stats
  const total = rows.reduce((a, r) => a + Number(r.amount || 0), 0);

  return NextResponse.json({ rows, summary: { total } });
}
