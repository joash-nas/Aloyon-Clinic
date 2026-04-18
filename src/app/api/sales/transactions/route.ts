// src/app/api/sales/transactions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

// ---- Auth / roles ----
const SECRET = process.env.NEXTAUTH_SECRET!;
const ALLOWED_ROLES = new Set(["admin", "doctor", "sales"]);

// ---- Types ----
export type SaleItem = {
  productId?: ObjectId;
  name: string;
  qty: number;
  price: number;
};

export type SaleRow = {
  _id?: ObjectId;
  date: Date;
  category: string;
  description: string;
  amount: number;
  paymentMethod: string; // Cash | GCash | Bank | PayMongo | QRPh | etc.
  items?: SaleItem[];
  createdBy?: string;
  updatedAt?: Date;
};

// ---- Helpers ----
function parseDate(s?: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(+d) ? null : d;
}

function normalizeItems(raw: unknown): SaleItem[] {
  if (!Array.isArray(raw)) return [];
  const out: SaleItem[] = [];

  for (const x of raw as unknown[]) {
    const name = String((x as { name?: unknown })?.name ?? "").trim();
    const qty = Number((x as { qty?: unknown })?.qty ?? 0);
    const price = Number((x as { price?: unknown })?.price ?? 0);

    let productId: ObjectId | undefined;
    const pid = (x as { productId?: unknown })?.productId;
    if (pid != null) {
      try {
        productId = new ObjectId(String(pid));
      } catch {
        productId = undefined;
      }
    }

    if (name && qty > 0 && price >= 0) {
      out.push({ name, qty, price, productId });
    }
  }

  return out;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Optional normalization so charts/filters don't split "QRPh" and "PayMongo"
function normalizePaymentMethod(method: string) {
  const m = String(method || "").trim();
  const lc = m.toLowerCase();
  if (lc === "qrph") return "PayMongo";
  return m || "Cash";
}

// ===================== GET =====================
export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: SECRET });
  const role = String(token?.role || "");
  if (!ALLOWED_ROLES.has(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const from = parseDate(searchParams.get("from"));
  const to = parseDate(searchParams.get("to"));
  const q = (searchParams.get("q") || "").trim();
  const category = (searchParams.get("category") || "").trim();
  const method = (searchParams.get("method") || "").trim();

  const db = await getDb();

  // Build query
  const where: Record<string, unknown> = {};

  if (from || to) {
    const range: Record<string, Date> = {};
    if (from) range.$gte = new Date(from.setHours(0, 0, 0, 0));
    if (to) range.$lte = new Date(to.setHours(23, 59, 59, 999));
    where.date = range;
  }

  if (category) where.category = category;

  // Payment method filter: case-insensitive + PayMongo groups QRPh
  if (method) {
    const m = method.toLowerCase();

    // If user chooses PayMongo, include both PayMongo and QRPh rows
    if (m === "paymongo") {
      where.paymentMethod = { $in: ["PayMongo", "paymongo", "PAYMONGO", "QRPh", "qrph", "QRPH"] };
    } else {
      where.paymentMethod = { $regex: `^${escapeRegex(method)}$`, $options: "i" };
    }
  }

  if (q) {
    // Works if you add a text index on { description: "text", category: "text" }
    where.$text = { $search: q };
  }

  const rows = await db
    .collection<SaleRow>("sales")
    .find(where, { sort: { date: -1, _id: -1 } })
    .toArray();

  // Summary
  let total = 0;
  const byCat = new Map<string, number>();

  for (const r of rows) {
    const amt = Number(r.amount || 0);
    total += amt;
    byCat.set(r.category, (byCat.get(r.category) || 0) + amt);
  }

  const byCategory = Array.from(byCat.entries()).map(([name, value]) => ({
    name,
    value,
  }));

  return NextResponse.json({
    rows: rows.map((r) => ({
      id: String(r._id),
      date: r.date,
      category: r.category,
      description: r.description,
      amount: r.amount,
      paymentMethod: normalizePaymentMethod(r.paymentMethod),
      items: r.items ?? [],
    })),
    summary: { total, byCategory },
  });
}

// ===================== POST =====================
export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: SECRET });
  const role = String(token?.role || "");
  if (!ALLOWED_ROLES.has(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Partial<{
    date: string;
    category: string;
    description: string;
    amount: number | string;
    paymentMethod: string;
    items: unknown;
  }>;

  const sale: SaleRow = {
    date: parseDate(body.date) ?? new Date(),
    category: String(body.category || "Other"),
    description: String(body.description || "").trim(),
    amount: Number(body.amount || 0),
    paymentMethod: normalizePaymentMethod(String(body.paymentMethod || "Cash")),
    items: normalizeItems(body.items),
    createdBy: String(token?.sub || ""),
    updatedAt: new Date(),
  };

  if (!sale.description && (sale.items?.length ?? 0) > 0) {
    sale.description = sale.items!.map((i) => `${i.name} ×${i.qty}`).join(", ");
  }

  if (!(sale.amount > 0)) {
    return NextResponse.json({ error: "Amount must be > 0" }, { status: 400 });
  }

  const db = await getDb();
  const res = await db.collection<SaleRow>("sales").insertOne(sale);
  return NextResponse.json({ ok: true, id: String(res.insertedId) });
}