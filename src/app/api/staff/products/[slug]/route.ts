/* eslint-disable @typescript-eslint/no-explicit-any */
/* =============================================================================
   File: src/app/api/staff/products/[slug]/route.ts
   Purpose: GET (detail), PUT (full update), PATCH (partial like featured),
            DELETE (remove product)
   Notes:
     • PATCH accepts { featured?: boolean, status?: "ACTIVE"|"DRAFT"|"ARCHIVED" }
   ============================================================================ */
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { z } from "zod";
import { ObjectId } from "mongodb";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;
  try {
    const db = await getDb();
    const doc = await db
      .collection("products")
      .findOne({ slug }, { projection: { _id: 0 } });

    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ product: doc }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

const ProductInput = z.object({
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

  // virtual try-on PNG GridFS id
  tryonImageId: z.string().nullable().optional(),

  // supplierId (required for edit too)
  supplierId: z.string().min(1),
});

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug: currentSlug } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = ProductInput.safeParse(body);

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const p = parsed.data;

  // validate ObjectId-like supplierId
  if (!/^[a-f\d]{24}$/i.test(p.supplierId)) {
    return NextResponse.json({ error: "Invalid supplierId." }, { status: 400 });
  }

  try {
    const db = await getDb();

    // prevent slug duplicates
    if (p.slug !== currentSlug) {
      const clash = await db
        .collection("products")
        .findOne({ slug: p.slug }, { projection: { _id: 1 } });
      if (clash) {
        return NextResponse.json(
          { error: "Slug already exists" },
          { status: 409 }
        );
      }
    }

    const res = await db.collection("products").updateOne(
      { slug: currentSlug },
      {
        $set: {
          ...p,
          currency: p.currency?.trim() || "PHP",
          id: p.slug,
          supplierId: new ObjectId(p.supplierId),

          material: p.material ?? null,
          shape: p.shape ?? null,
          color: p.color ?? null,
          category: p.category ?? null,
          size_ml:
            p.size_ml === null || Number.isNaN(p.size_ml) ? null : p.size_ml,
          size_count:
            p.size_count === null || Number.isNaN(p.size_count)
              ? null
              : p.size_count,
          dosage: p.dosage ?? null,

          product_type: p.product_type ?? null,
          tryonImageId: p.tryonImageId ?? null,
          updatedAt: new Date(),
        },

        // Remove old frame-spec fields if they exist in older docs
        $unset: {
          bridge_width_mm: "",
          lens_width_mm: "",
          temple_length_mm: "",
        },
      }
    );

    if (res.matchedCount === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, slug: p.slug }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

const PatchInput = z.object({
  featured: z.boolean().optional(),
  status: z.enum(["ACTIVE", "DRAFT", "ARCHIVED"]).optional(),
});

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = PatchInput.safeParse(body);
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "Invalid patch" }, { status: 400 });
  }

  try {
    const db = await getDb();
    const $set: Record<string, any> = {};
    if (parsed.data.featured !== undefined) $set.featured = !!parsed.data.featured;
    if (parsed.data.status) $set.status = parsed.data.status;

    const res = await db
      .collection("products")
      .updateOne({ slug }, { $set, $currentDate: { updatedAt: true } });

    if (!res.matchedCount) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;
  try {
    const db = await getDb();
    const res = await db.collection("products").deleteOne({ slug });
    if (!res.deletedCount) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}