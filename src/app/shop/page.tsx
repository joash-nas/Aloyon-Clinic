/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/shop/page.tsx
import { WithId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import ShopClient from "@/components/shop/ShopClient";
import type { ProductCard } from "@/types/product";

export const dynamic = "force-dynamic";

type ProductDoc = {
  id?: string;
  slug: string;
  name: string;
  brand: string;
  price: number;
  currency: string;
  qty: number;
  status: "active" | "draft" | "archived";
  featured?: boolean;
  thumbnail?: string | null;
  image1?: string | null;

  imageIds?: string[];
  primaryImageId?: string | null;

  material?: string | null;
  shape?: string | null;
  rating?: number | null;
  reviews_count?: number | null;

  product_type?:
    | "frames"
    | "eyedrops"
    | "accessory"
    | "solution"
    | "contact-lens"
    | null;
  category?: string | null;
  size_ml?: number | null;
  size_count?: number | null;
  dosage?: string | null;
  createdAt?: Date;
};

type IdDoc = { _id: string | null };

const toCard = (d: WithId<ProductDoc>): ProductCard => {
  let thumb: string | null = null;

  if (Array.isArray(d.imageIds) && d.imageIds.length > 0) {
    const primaryId =
      d.primaryImageId && d.imageIds.includes(d.primaryImageId)
        ? d.primaryImageId
        : d.imageIds[0];
    thumb = `/api/images/${primaryId}`;
  } else if (d.thumbnail && d.thumbnail.trim() !== "") {
    thumb = d.thumbnail;
  } else if (d.image1 && d.image1.trim() !== "") {
    thumb = d.image1;
  }

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
    thumbnail: thumb,
    image1: null,
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
};

const mapUnique = (rows: IdDoc[]): string[] =>
  Array.from(new Set(rows.map((r) => r._id).filter(Boolean) as string[])).sort(
    (a, b) => a.localeCompare(b)
  );

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
    sort?: string;
    status?: string;
    type?: string;
    material?: string;
    shape?: string;
    brand?: string;
    density?: string;
  }>;
}) {
  const sp = await searchParams;

  const page = Math.max(1, Number(sp?.page ?? 1));
  const limit = 8;
  const skip = (page - 1) * limit;

  const q = (sp?.q ?? "").trim();
  const sortUi = (sp?.sort ?? "relevance").toLowerCase();
  const status = (sp?.status ?? "active").toLowerCase();
  const type = (sp?.type ?? "all").toLowerCase();
  const material = (sp?.material ?? "").trim().toLowerCase();
  const shape = (sp?.shape ?? "").trim().toLowerCase();

  const densityRaw = (sp?.density ?? "comfort").trim().toLowerCase();
  const density =
    densityRaw === "compact" || densityRaw === "list" ? densityRaw : "comfort";

  const brandsFromUrl = (sp?.brand ?? "")
    .split(",")
    .map((b) => b.trim())
    .filter(Boolean);

  const filter: Record<string, unknown> = {};

  if (status !== "any") filter.status = "active";
  if (type !== "all") filter.product_type = type;

  if (material) {
    filter.material = { $regex: `^${escapeRegex(material)}$`, $options: "i" };
  }

  if (shape) {
    filter.shape = { $regex: `^${escapeRegex(shape)}$`, $options: "i" };
  }

  if (brandsFromUrl.length) {
    filter.$and = [
      ...(Array.isArray(filter.$and) ? (filter.$and as any[]) : []),
      {
        $or: brandsFromUrl.map((b) => ({
          brand: { $regex: `^${escapeRegex(b)}$`, $options: "i" },
        })),
      },
    ];
  }

  if (q) {
    const rx = { $regex: q, $options: "i" };
    filter.$and = [
      ...(Array.isArray(filter.$and) ? (filter.$and as any[]) : []),
      {
        $or: [{ name: rx }, { brand: rx }],
      },
    ];
  }

  const optionsFilter: Record<string, unknown> = {};
  if (status !== "any") optionsFilter.status = "active";

  const sortSpec: Record<string, 1 | -1> =
    sortUi === "price-asc"
      ? { price: 1 }
      : sortUi === "price-desc"
      ? { price: -1 }
      : sortUi === "name-asc"
      ? { name: 1 }
      : { createdAt: -1, reviews_count: -1, rating: -1, name: 1 };

  const db = await getDb();
  const col = db.collection<ProductDoc>("products");

  const [docs, total, allTypesRaw, allBrandsRaw] = await Promise.all([
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
          imageIds: 1,
          primaryImageId: 1,
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

    col
      .aggregate<IdDoc>([
        { $match: optionsFilter },
        { $group: { _id: "$product_type" } },
      ])
      .toArray(),

    col
      .aggregate<IdDoc>([
        { $match: optionsFilter },
        { $group: { _id: "$brand" } },
      ])
      .toArray(),
  ]);

  const allProductTypes = mapUnique(allTypesRaw);
  const allBrands = mapUnique(allBrandsRaw);

  return (
    <ShopClient
      initialProducts={docs.map(toCard)}
      total={total}
      page={page}
      limit={limit}
      qFromUrl={q}
      allProductTypes={allProductTypes}
      allBrands={allBrands}
      typeFromUrl={type as any}
      sortFromUrl={sortUi as any}
      materialFromUrl={material}
      shapeFromUrl={shape}
      brandsFromUrl={brandsFromUrl}
      densityFromUrl={density as any}
    />
  );
}