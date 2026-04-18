import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getDb } from "@/lib/mongodb";

const SECRET = process.env.NEXTAUTH_SECRET!;
const OK = new Set(["admin", "doctor", "sales"]);

type Row = { date: Date; amount: number; category?: string };
type AggItem = { name: string; total: number };

function dstr(d: Date) {
  return new Date(d).toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: SECRET });
  if (!token || !OK.has(String(token.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const fromStr = searchParams.get("from") || "";
  const toStr = searchParams.get("to") || "";

  const from = fromStr ? new Date(fromStr + "T00:00:00.000Z") : null;
  const to = toStr ? new Date(toStr + "T23:59:59.999Z") : null;

  const db = await getDb();

  const matchRange = (col: "sales" | "expenses") => {
    const where: any = {};
    if (from || to) {
      where.date = {};
      if (from) where.date.$gte = from;
      if (to) where.date.$lte = to;
    }
    return where;
  };

  // Helpers for a day string
  const dayStr = { $dateToString: { format: "%Y-%m-%d", date: "$date" } };

  // --- SALES aggregations ---
  const salesByDay = await db.collection<Row>("sales").aggregate([
    { $match: matchRange("sales") },
    { $project: { day: dayStr, amount: "$amount" } },
    { $group: { _id: "$day", total: { $sum: "$amount" } } },
    { $project: { _id: 0, day: "$_id", total: 1 } },
    { $sort: { day: 1 } },
  ]).toArray();

  const salesByCategory = await db.collection<Row>("sales").aggregate([
    { $match: matchRange("sales") },
    { $group: { _id: "$category", total: { $sum: "$amount" } } },
    { $project: { _id: 0, name: "$_id", total: 1 } },
    { $sort: { total: -1 } },
  ]).toArray();

  const topItems = await db.collection("sales").aggregate([
    { $match: matchRange("sales") },
    { $unwind: { path: "$items", preserveNullAndEmptyArrays: false } },
    { $group: {
        _id: "$items.name",
        qty: { $sum: "$items.qty" },
        revenue: { $sum: { $multiply: ["$items.qty", "$items.price"] } },
    }},
    { $project: { _id: 0, name: "$_id", qty: 1, revenue: 1 } },
    { $sort: { qty: -1, revenue: -1 } },
    { $limit: 10 },
  ]).toArray();

  const salesTotalDoc = await db.collection("sales").aggregate([
    { $match: matchRange("sales") },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]).next();
  const salesTotal = Number(salesTotalDoc?.total || 0);

  // --- EXPENSES aggregations ---
  const expensesByDay = await db.collection<Row>("expenses").aggregate([
    { $match: matchRange("expenses") },
    { $project: { day: dayStr, amount: "$amount" } },
    { $group: { _id: "$day", total: { $sum: "$amount" } } },
    { $project: { _id: 0, day: "$_id", total: 1 } },
    { $sort: { day: 1 } },
  ]).toArray();

  const expensesByCategory = await db.collection<Row>("expenses").aggregate([
    { $match: matchRange("expenses") },
    { $group: { _id: "$category", total: { $sum: "$amount" } } },
    { $project: { _id: 0, name: "$_id", total: 1 } },
    { $sort: { total: -1 } },
  ]).toArray();

  const expensesTotalDoc = await db.collection("expenses").aggregate([
    { $match: matchRange("expenses") },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]).next();
  const expensesTotal = Number(expensesTotalDoc?.total || 0);

  // Compose time-series NET = sales - expenses, day-aligned
  const dayMap = new Map<string, { sales: number; expenses: number }>();
  for (const s of salesByDay as { day: string; total: number }[]) {
    dayMap.set(s.day, { sales: s.total, expenses: 0 });
  }
  for (const e of expensesByDay as { day: string; total: number }[]) {
    const cur = dayMap.get(e.day) || { sales: 0, expenses: 0 };
    cur.expenses = e.total;
    dayMap.set(e.day, cur);
  }
  const netByDay = Array.from(dayMap.entries())
    .map(([day, v]) => ({ day, sales: v.sales, expenses: v.expenses, net: v.sales - v.expenses }))
    .sort((a, b) => a.day.localeCompare(b.day));

  return NextResponse.json({
    range: { from: fromStr || null, to: toStr || null },
    totals: {
      sales: salesTotal,
      expenses: expensesTotal,
      net: salesTotal - expensesTotal,
    },
    series: {
      salesByDay,
      expensesByDay,
      netByDay,
    },
    breakdown: {
      salesByCategory,
      expensesByCategory,
      topItems,
    },
  });
}
