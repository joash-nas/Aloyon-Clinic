/* eslint-disable @typescript-eslint/no-explicit-any */
/* =============================================================================
   File: src/app/api/staff/products/route.ts
   Purpose:
     - GET: List products (pagination + filters) for Assistant table
     - POST: Create product (requires supplierId, stored as ObjectId)
   ============================================================================ */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export const dynamic = "force-dynamic";

/* ===========================
   GET: LIST PRODUCTS
   =========================== */

const Query = z.object({
  q: z.string().optional(),
  status: z.enum(["any", "active", "draft", "archived"]).optional(),
  featured: z.enum(["0", "1"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["name", "newest", "qty", "price"]).optional().default("name"),
});

function toRow(d: any) {
  return {
    name: d.name ?? "",
    slug: d.slug ?? "",
    price: Number(d.price ?? 0),
    qty: Number(d.qty ?? 0),
    status: String(d.status ?? "draft"),
    featured: !!d.featured,
    product_type: d.product_type ?? "",
    supplierId: d.supplierId ? String(d.supplierId) : null,
  };
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const parsed = Query.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid query" }, { status: 400 });
    }

    const { q, status = "any", featured, page, limit, sort } = parsed.data;

    const db = await getDb();
    const col = db.collection("products");

    const filter: Record<string, any> = {};
    if (status !== "any") {
      filter.status = { $in: [status, status.toUpperCase()] };
    }
    if (featured === "1") filter.featured = true;

    if (q?.trim()) {
      const term = q.trim();
      filter.$or = [
        { name: { $regex: term, $options: "i" } },
        { slug: { $regex: term, $options: "i" } },
        { brand: { $regex: term, $options: "i" } },
      ];
    }

    let sortSpec: Record<string, 1 | -1> = { name: 1 };
    if (sort === "newest") sortSpec = { createdAt: -1, _id: -1 };
    else if (sort === "qty") sortSpec = { qty: -1, name: 1 };
    else if (sort === "price") sortSpec = { price: -1, name: 1 };

    const skip = (page - 1) * limit;

    const [docs, total] = await Promise.all([
      col
        .find(filter, {
          projection: {
            _id: 0,
            name: 1,
            slug: 1,
            price: 1,
            qty: 1,
            status: 1,
            featured: 1,
            product_type: 1,
            supplierId: 1,
            createdAt: 1,
          },
        })
        .sort(sortSpec)
        .skip(skip)
        .limit(limit)
        .toArray(),
      col.countDocuments(filter),
    ]);

    return NextResponse.json(
      { items: docs.map(toRow), total, page, limit },
      { status: 200 }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to fetch products";
    return NextResponse.json(
      { error: msg, items: [], total: 0, page: 1, limit: 20 },
      { status: 500 }
    );
  }
}

/* ===========================
   POST: CREATE PRODUCT
   =========================== */

const CreateProductInput = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  brand: z.string().trim().optional(),
  price: z.coerce.number().min(0),
  currency: z.string().trim().optional(),
  qty: z.coerce.number().int().min(0),
  status: z.enum(["active", "draft", "archived"]),
  featured: z.boolean().optional(),
  product_type: z
    .enum(["frames", "eyedrops", "accessory", "solution", "contact-lens"])
    .nullable()
    .optional(),
  material: z.string().nullable().optional(),
  shape: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  size_ml: z.coerce.number().nullable().optional(),
  size_count: z.coerce.number().nullable().optional(),
  dosage: z.string().nullable().optional(),
  imageIds: z.array(z.string()).min(1),
  primaryImageId: z.string().min(1),
  tryonImageId: z.string().nullable().optional(),

  supplierId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = CreateProductInput.safeParse(body);

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }

  const p = parsed.data;

  if (!/^[a-f\d]{24}$/i.test(p.supplierId)) {
    return NextResponse.json({ ok: false, error: "Invalid supplierId." }, { status: 400 });
  }

  try {
    const db = await getDb();
    const col = db.collection("products");

    const clash = await col.findOne({ slug: p.slug }, { projection: { _id: 1 } });
    if (clash) {
      return NextResponse.json({ ok: false, error: "Slug already exists" }, { status: 409 });
    }

    const now = new Date();

    await col.insertOne({
      id: p.slug,
      ...p,
      currency: (p as any).currency?.trim() || "PHP",
      supplierId: new ObjectId(p.supplierId),

      material: p.material ?? null,
      shape: p.shape ?? null,
      color: p.color ?? null,
      category: p.category ?? null,
      size_ml: p.size_ml ?? null,
      size_count: p.size_count ?? null,
      dosage: p.dosage ?? null,

      product_type: p.product_type ?? null,
      tryonImageId: p.tryonImageId ?? null,

      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ ok: true, slug: p.slug }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to create product" },
      { status: 500 }
    );
  }
}