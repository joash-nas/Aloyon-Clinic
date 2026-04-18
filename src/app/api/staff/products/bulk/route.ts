/* =============================================================================
   File: src/app/api/staff/products/bulk/route.ts
   Purpose: CSV bulk import for staff.
   Fixes:
     • Ensures empty image fields become null.
     • Sets thumbnail/image1 from primary_image_url + image_urls split.
   ============================================================================ */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/mongodb";

const Item = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  brand: z.string().optional(),
  price: z.coerce.number().min(0),
  qty: z.coerce.number().int().min(0),
  status: z.enum(["active","draft","archived"]),
  featured: z.coerce.boolean().optional().default(false),

  product_type: z.enum(["frames","eyedrops","accessory","solution","contact-lens"]).optional().nullable(),
  material: z.string().optional().nullable(),
  shape: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  size_ml: z.coerce.number().optional().nullable(),
  size_count: z.coerce.number().optional().nullable(),
  dosage: z.string().optional().nullable(),

  primary_image_url: z.string().optional().default(""),
  image_urls: z.string().optional().default(""),
});

const Payload = z.object({ items: z.array(Item).min(1) });
const nn = (s?: string | null) => (s && s.trim() !== "" ? s.trim() : null);

export async function GET() {
  const header = [
    "name","slug","brand","price","qty","status","featured",
    "product_type","material","shape","category","size_ml","size_count","dosage",
    "primary_image_url","image_urls"
  ].join(",") + "\n";

  return new NextResponse(header, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="products_template.csv"`,
    },
  });
}

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = Payload.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const db = await getDb();
  const col = db.collection("products");

  const results: Array<{ slug?: string; ok: boolean; error?: string }> = [];

  for (const row of parsed.data.items) {
    try {
      const p = Item.parse(row);

      const exists = await col.findOne({ slug: p.slug }, { projection: { _id: 1 } });
      if (exists) { results.push({ slug: p.slug, ok: false, error: "Duplicate slug" }); continue; }

      const ordered = [nn(p.primary_image_url), ...(nn(p.image_urls)?.split("|") ?? [])]
        .map(s => (s ?? "").trim())
        .filter(Boolean);

      const doc = {
        id: p.slug,
        name: p.name,
        slug: p.slug,
        brand: nn(p.brand) ?? "EO",
        price: p.price,
        currency: "PHP",
        qty: p.qty,
        status: p.status,
        featured: !!p.featured,

        product_type: nn(p.product_type as any),
        material: nn(p.material),
        shape: nn(p.shape),
        category: nn(p.category),
        size_ml: p.size_ml ?? undefined,
        size_count: p.size_count ?? undefined,
        dosage: nn(p.dosage),

        thumbnail: ordered[0] ?? null,
        image1: ordered[1] ?? null,

        rating: null,
        reviews_count: null,
        createdAt: new Date(),
      };

      await col.insertOne(doc);
      results.push({ slug: p.slug, ok: true });
    } catch (e) {
      results.push({ slug: (row as any)?.slug, ok: false, error: (e as Error).message });
    }
  }

  return NextResponse.json({ results }, { status: 200 });
}
