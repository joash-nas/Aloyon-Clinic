// src/app/product/[slug]/page.tsx

import { notFound } from "next/navigation";
import Link from "next/link";
import { WithId } from "mongodb";
import { getServerSession } from "next-auth";
import { getDb } from "@/lib/mongodb";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import AddToCart from "@/components/products/AddToCart";
import ProductGallery from "@/components/products/ProductGallery";
import ReviewSection from "@/components/products/ReviewSection";

// This page hits MongoDB at request-time, so keep it dynamic.
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Product = {
  id: string;
  slug: string;
  name: string;
  brand: string;
  price: number;
  currency: string;
  qty: number;
  status: "active" | "draft" | "archived";
  featured: boolean;

  // legacy image fields (old records)
  thumbnail: string | null;
  image1: string | null;
  image2: string | null;

  // new image model
  imageIds?: string[];
  primaryImageId?: string | null;

  // type + virtual try-on
  product_type?:
    | "frames"
    | "eyedrops"
    | "accessory"
    | "solution"
    | "contact-lens"
    | null;
  tryonImageId?: string | null;

  color: string | null;
  material: string | null;
  shape: string | null;

  description: string | null;
  rating: number | null;
  reviews_count: number | null;
};

type ProductDoc = Omit<Product, "id"> & { id?: string };

function mapDoc(d: WithId<ProductDoc>): Product {
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

    thumbnail: d.thumbnail ?? null,
    image1: d.image1 ?? null,
    image2: d.image2 ?? null,

    imageIds: Array.isArray(d.imageIds) ? d.imageIds : undefined,
    primaryImageId: d.primaryImageId ?? null,

    product_type: d.product_type ?? null,
    tryonImageId: d.tryonImageId ?? null,

    color: d.color ?? null,
    material: d.material ?? null,
    shape: d.shape ?? null,

    description: d.description ?? null,
    rating: d.rating ?? null,
    reviews_count: d.reviews_count ?? null,
  };
}

/**
 * Decide what single image URL to use as the "cover" for a product card.
 * 1) If we have GridFS images (imageIds), use primaryImageId (or the first id)
 * 2) Else fall back to legacy thumbnail / image1
 */
function getCoverUrl(p: Product): string {
  if (p.imageIds && p.imageIds.length > 0) {
    const primaryId =
      p.primaryImageId && p.imageIds.includes(p.primaryImageId)
        ? p.primaryImageId
        : p.imageIds[0];
    return `/api/images/${primaryId}`;
  }
  return p.thumbnail ?? p.image1 ?? "/placeholder.png";
}

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ProductDetail({ params }: PageProps) {
  const { slug } = await params;

  const session = await getServerSession(authOptions);
  const userRole = String(session?.user?.role ?? "").toUpperCase();
  const isPatient = userRole === "PATIENT";

  const db = await getDb();
  const col = db.collection<ProductDoc>("products");

  const found = await col.findOne({ slug, status: "active" });
  if (!found) return notFound();

  const product = mapDoc(found as WithId<ProductDoc>);

  // ---------- Main gallery (prefer GridFS) ----------
  let gallery: string[] = [];
  if (product.imageIds && product.imageIds.length > 0) {
    const urls = product.imageIds.map((id) => `/api/images/${id}`);
    if (product.primaryImageId) {
      const primaryUrl = `/api/images/${product.primaryImageId}`;
      gallery = [primaryUrl, ...urls.filter((u) => u !== primaryUrl)];
    } else {
      gallery = urls;
    }
  } else {
    gallery = [product.thumbnail, product.image1, product.image2].filter(
      Boolean
    ) as string[];
  }

  // ---------- Related products ----------
  const relatedBrand = await col
    .find({
      brand: product.brand,
      status: "active",
      slug: { $ne: product.slug },
    })
    .limit(6)
    .toArray();

  const relatedShape =
    relatedBrand.length < 3
      ? await col
          .find({
            shape: product.shape,
            status: "active",
            slug: { $ne: product.slug },
          })
          .limit(6)
          .toArray()
      : [];

  const seen = new Set<string>();
  const related = [...relatedBrand, ...relatedShape]
    .filter((d) => {
      const key = (d as WithId<ProductDoc>)._id.toString();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6)
    .map((d) => mapDoc(d as WithId<ProductDoc>));

  return (
    <div className="space-y-8">
      <nav className="text-xs">
        <Link href="/shop" className="link-muted">
          Shop
        </Link>{" "}
        / <span>{product.name}</span>
      </nav>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <ProductGallery urls={gallery} alt={product.name} />

        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold">{product.name}</h1>
            <span className="badge">{product.brand}</span>
          </div>

          <div className="text-sm text-muted capitalize">
            {product.material ?? "—"}
            {product.shape ? ` • ${product.shape}` : ""}
            {product.color ? ` • ${product.color}` : ""}
          </div>

          <div className="text-2xl font-semibold">
            ₱{Number(product.price).toLocaleString("en-PH")}
          </div>

          {product.product_type === "frames" && product.tryonImageId && (
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="badge">Virtual try-on available</span>
              <Link
                href={`/virtual-try-on?slug=${encodeURIComponent(product.slug)}`}
                className="btn btn-ghost text-xs"
              >
                👓 Try on virtually
              </Link>
            </div>
          )}

          {product.rating ? (
            <div className="text-xs text-muted">
              ★ {Number(product.rating).toFixed(1)} ({product.reviews_count ?? 0})
            </div>
          ) : (
            <div className="text-xs text-muted">No reviews yet</div>
          )}

          <p className="text-sm text-muted">
            {product.description ??
              "Premium frames with clinic-grade quality and comfortable fit."}
          </p>

          <div className="flex items-center gap-3 flex-wrap">
            {product.qty > 0 ? (
              <>
                <AddToCart
                  productId={product.id}
                  name={product.name}
                  price={Number(product.price)}
                  image={gallery[0] ?? "/placeholder.png"}
                  inStock={true}
                  maxQty={product.qty}
                />
                {product.qty <= 5 ? (
                  <span className="badge">Low stock ({product.qty} left)</span>
                ) : (
                  <span className="text-xs text-muted">
                    In stock: {product.qty}
                  </span>
                )}
              </>
            ) : (
              <>
                <button
                  className="btn btn-ghost opacity-60 cursor-not-allowed"
                  disabled
                >
                  Out of stock
                </button>
                <span className="text-xs text-muted">
                  This item is currently unavailable.
                </span>
              </>
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            {isPatient && (
              <Link href="/dashboard/appointments" className="btn btn-ghost">
                Book eye exam
              </Link>
            )}

            <Link href="/shop" className="btn btn-ghost">
              Back to shop
            </Link>
          </div>
        </div>
      </section>

      <ReviewSection
      slug={product.slug}
      initialAverage={product.rating}
      initialCount={product.reviews_count}
      canReview={isPatient}
/>

      {related.length > 0 && (
        <>
          <div className="flex items-end justify-between">
            <div>
              <h3 className="text-xl font-semibold">You may also like</h3>
              <p className="text-sm text-muted">Similar brand or shape</p>
            </div>
            <Link href="/shop" className="link-muted">
              View all
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {related.map((it) => {
              const img = getCoverUrl(it);
              return (
                <Link
                  key={it.id}
                  href={`/product/${it.slug}`}
                  className="no-underline text-inherit"
                >
                  <div className="card p-0 overflow-hidden hover:-translate-y-1 transition">
                    <div className="aspect-[4/3] bg-[var(--muted)]">
                      <img
                        src={img}
                        alt={it.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="text-base font-semibold">{it.name}</h4>
                        <span className="badge">{it.brand}</span>
                      </div>
                      <p className="text-sm text-muted capitalize">
                        {it.material ?? "—"}
                        {it.shape ? ` • ${it.shape}` : ""}
                      </p>
                      <div className="mt-2 font-semibold">
                        ₱{Number(it.price).toLocaleString("en-PH")}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}