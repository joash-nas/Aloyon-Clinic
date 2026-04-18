/* 
   File: src/app/api/products/route.ts
   Purpose: Public products listing with pagination + server-side search/filter.
   What’s new in this version:
     • ?q=term  → case-insensitive search on name, brand, category, product_type
     • ?sort=relevance|price_asc|price_desc|name_asc|newest (default: relevance)
*/
import { NextRequest, NextResponse } from "next/server";
import { WithId } from "mongodb";
import { getDb } from "@/lib/mongodb";

type ProdType = "frames" | "eyedrops" | "accessory" | "solution" | "contact-lens";
type ProductDoc = {
  id?: string;
  slug: string;
  name: string;
  brand: string;
  price: number;
  currency: string;
  qty: number;
  status: "active" | "draft" | "archived";
  featured: boolean;

  thumbnail?: string | null;
  image1?: string | null;

  material?: string | null;
  shape?: string | null;

  rating?: number | null;
  reviews_count?: number | null;
  createdAt?: Date;

  product_type?: ProdType | null;
  category?: string | null;
  size_ml?: number | null;
  size_count?: number | null;
  dosage?: string | null;
};

const imgOrNull = (v?: string | null) => (v && v.trim() !== "" ? v : null);

function mapOut(d: WithId<ProductDoc>) {
  return {
    id: d.id ?? d._id.toString(),
    slug: d.slug,
    name: d.name,
    brand: d.brand,
    price: d.price,
    currency: d.currency,
    qty: d.qty,
    status: d.status,
    featured: !!d.featured,

    thumbnail: imgOrNull(d.thumbnail ?? null),
    image1: imgOrNull(d.image1 ?? null),

    material: d.material ?? null,
    shape: d.shape ?? null,
    rating: d.rating ?? null,
    reviews_count: d.reviews_count ?? null,

    product_type: d.product_type ?? null,
    category: d.category ?? null,
    size_ml: d.size_ml ?? null,
    size_count: d.size_count ?? null,
    dosage: d.dosage ?? null,
  };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  // Paging
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const limit = Math.min(60, Math.max(1, Number(url.searchParams.get("limit") ?? 24)));
  const skip = (page - 1) * limit;

  // Filters
  const statusParam = (url.searchParams.get("status") || "active").toLowerCase();
  const q = (url.searchParams.get("q") || "").trim();
  const inStock = url.searchParams.get("inStock") === "1";

  // Sort
  const sortParam = (url.searchParams.get("sort") || "relevance").toLowerCase();
 
  const sortSpec: Record<string, 1 | -1> =
    sortParam === "price_asc"  ? { price: 1,  _id: 1 } :
    sortParam === "price_desc" ? { price: -1, _id: 1 } :
    sortParam === "name_asc"   ? { name: 1,   _id: 1 } :
    sortParam === "newest"     ? { createdAt: -1, _id: -1 } :
  
    { reviews_count: -1, rating: -1, createdAt: -1, _id: -1 };

  // filter
  const filter: Record<string, unknown> =
    statusParam === "any" ? {} : { status: "active" };
  if (q) {
    const rx = { $regex: q, $options: "i" };
    filter.$or = [{ name: rx }, { brand: rx }, { category: rx }, { product_type: rx }];
  }
  if (inStock) filter.qty = { $gt: 0 };

  const db = await getDb();
  const col = db.collection<ProductDoc>("products");

  const [items, totalFiltered, totalAny] = await Promise.all([
    col
      .find(filter, {
        projection: {
          _id: 1,
          id: 1,
          slug: 1,
          name: 1,
          brand: 1,
          price: 1,
          currency: 1,
          qty: 1,
          status: 1,
          featured: 1,
          thumbnail: 1,
          image1: 1,
          material: 1,
          shape: 1,
          rating: 1,
          reviews_count: 1,
          product_type: 1,
          category: 1,
          size_ml: 1,
          size_count: 1,
          dosage: 1,
          createdAt: 1,
        },
      })
      .sort(sortSpec)
      .skip(skip)
      .limit(limit)
      .toArray(),
    col.countDocuments(filter),
    col.countDocuments({}),
  ]);

  console.log(
    "[/api/products] page=%d limit=%d status=%s q=%s sort=%s → filtered=%d / any=%d",
    page, limit, statusParam, q, sortParam, totalFiltered, totalAny
  );

  return NextResponse.json({
    items: items.map(mapOut),
    total: totalFiltered,
    page,
    limit,
    debug: { status: statusParam, q, sort: sortParam, totalAny },
  });
}
