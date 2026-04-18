import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { getDb } from "@/lib/mongodb";

const SECRET = process.env.NEXTAUTH_SECRET!;
const ALLOWED = new Set(["sales", "doctor", "admin"]);

const esc = (v: any) => {
  const s = (v ?? "").toString();
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: SECRET });
  if (!token?.role || !ALLOWED.has(String(token.role))) {
    return new Response("Forbidden", { status: 403 });
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
  if (category) match.category = category;
  if (method) match.paymentMethod = method;

  const db = await getDb();
  const rows = await db.collection("expenses").find(match).sort({ date: -1, _id: -1 }).toArray();

  const header = ["Date","Category","Description","Amount","Method","ID"].map(esc).join(",") + "\n";
  const body = rows.map((r) =>
    [esc(new Date(r.date).toLocaleDateString()), esc(r.category), esc(r.description),
     esc(Number(r.amount).toFixed(2)), esc(r.paymentMethod), esc(String(r._id))]
    .join(",")
  ).join("\n");

  const csv = header + body + (body ? "\n" : "");
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=expenses.csv",
      "Cache-Control": "no-store",
    },
  });
}
