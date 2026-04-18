/* =============================================================================
   File: src/app/page.tsx
   Purpose: Home page with hero, promo, compact mobile featured/new rails.
   ============================================================================ */
import Link from "next/link";
import Image from "next/image";
import { WithId } from "mongodb";
import type { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { getDb } from "@/lib/mongodb";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

type ProductDoc = {
  id?: string;
  slug: string;
  name: string;
  brand: string;
  price: number;
  currency?: string;
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
  createdAt?: Date;
};

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
  thumbnail: string | null;
  image1: string | null;
  material: string | null;
  shape: string | null;
  rating: number | null;
  reviews_count: number | null;
};

type PromoDoc = {
  id?: string;
  title: string;
  subtitle?: string | null;
  image_url?: string | null;
  cta_label?: string | null;
  cta_href?: string | null;
  start_at?: Date;
};

type Promo = {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  cta_label: string | null;
  cta_href: string | null;
};

function safeUrl(...candidates: Array<string | null | undefined>): string {
  for (const c of candidates) {
    if (!c) continue;
    const s = String(c).trim();
    if (!s || s === "-" || s === "—" || s.toLowerCase() === "n/a") continue;
    if (s.startsWith("/")) return s;
    if (/^https?:\/\//i.test(s)) return s;
  }
  return "/placeholder.png";
}

const toProduct = (doc: WithId<ProductDoc>): Product => {
  let thumb: string | null = null;

  if (Array.isArray(doc.imageIds) && doc.imageIds.length > 0) {
    const primaryId =
      doc.primaryImageId && doc.imageIds.includes(doc.primaryImageId)
        ? doc.primaryImageId
        : doc.imageIds[0];
    thumb = `/api/images/${primaryId}`;
  } else if (doc.thumbnail && doc.thumbnail.trim() !== "") {
    thumb = doc.thumbnail;
  } else if (doc.image1 && doc.image1.trim() !== "") {
    thumb = doc.image1;
  }

  return {
    id: doc.id ?? doc._id.toString(),
    slug: doc.slug,
    name: doc.name,
    brand: doc.brand,
    price: Number(doc.price),
    currency: doc.currency ?? "PHP",
    qty: Number(doc.qty),
    status: doc.status,
    featured: !!doc.featured,
    thumbnail: thumb,
    image1: null,
    material: doc.material ?? null,
    shape: doc.shape ?? null,
    rating: doc.rating ?? null,
    reviews_count: doc.reviews_count ?? null,
  };
};

const toPromo = (doc: WithId<PromoDoc>): Promo => ({
  id: doc.id ?? doc._id.toString(),
  title: doc.title,
  subtitle: doc.subtitle ?? null,
  image_url: doc.image_url ?? null,
  cta_label: doc.cta_label ?? null,
  cta_href: doc.cta_href ?? null,
});

export default async function Home() {
  const db = await getDb();
  const session = await getServerSession(authOptions);

  const userRole = String(session?.user?.role ?? "").toUpperCase();
  const canBookExam =
    userRole === "PATIENT";

  const [featuredDocs, newDocs, promoDocs] = await Promise.all([
    db
      .collection<ProductDoc>("products")
      .find({ status: "active", featured: true })
      .sort({ name: 1 })
      .limit(8)
      .toArray(),

    db
      .collection<ProductDoc>("products")
      .find({ status: "active" })
      .sort({ createdAt: -1 })
      .limit(12)
      .toArray(),

    db
      .collection<PromoDoc>("promos")
      .find({})
      .sort({ start_at: -1 })
      .limit(1)
      .toArray(),
  ]);

  const featured = featuredDocs.map(toProduct);
  const newArrivals = newDocs.map(toProduct);
  const promo = promoDocs[0] ? toPromo(promoDocs[0]) : undefined;

  const featuredToShow = featured.length ? featured : newArrivals.slice(0, 8);

  return (
    <div className="space-y-7 md:space-y-10">
      {/* HERO */}
      <section className="relative overflow-hidden card p-4 sm:p-5 md:p-8">
        <div className="absolute inset-0 pointer-events-none opacity-[.12] bg-gradient-to-r from-[var(--primary)]/50 via-transparent to-[var(--primary)]/40" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 items-center relative">
          <div className="md:col-span-2">
            <span className="badge text-[11px] md:text-xs">
              Built for optical clinics
            </span>

            <h1 className="mt-3 text-2xl leading-tight sm:text-3xl md:text-4xl font-semibold tracking-tight max-w-2xl">
              See better, look better — with{" "}
              <span style={{ color: "var(--primary)" }}>Aloyon Optical</span>
            </h1>

            <p className="mt-2 text-sm md:text-base text-muted max-w-2xl">
              Shop frames, book eye exams, and manage your visits — all in one
              elegant app.
            </p>

            <div className="mt-4 md:mt-6 flex flex-wrap items-center gap-2 sm:gap-3">
              <Link href="/shop" className="btn btn-primary">
                Shop frames
              </Link>

              {canBookExam && (
                <Link href="/dashboard/appointments" className="btn btn-ghost">
                  Book exam
                </Link>
              )}
            </div>
          </div>

          {/* Smaller carousel on mobile */}
          <div className="relative aspect-[16/10] sm:aspect-[3/2] rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--muted)]">
            <Image
              src="/aloyon-front.jpg"
              alt="Aloyon Optical clinic front"
              fill
              className="object-cover clinic-slide clinic-slide-2"
              sizes="(max-width:768px) 100vw, 33vw"
            />
            <Image
              src="/aloyon-clinic.jpg"
              alt="Aloyon Optical clinic interior"
              fill
              className="object-cover clinic-slide clinic-slide-1"
              sizes="(max-width:768px) 100vw, 33vw"
              priority
            />
          </div>
        </div>
      </section>

      {/* VIRTUAL TRY-ON ANNOUNCEMENT */}
      <section className="card p-4 md:p-5 border border-[var(--border)] bg-white/90">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 md:h-10 md:w-10 rounded-xl bg-[var(--primary)]/15 flex items-center justify-center text-lg md:text-xl shrink-0">
              👓
            </div>

            <div>
              <div className="text-sm font-semibold">
                New feature: Virtual Try-On is now available
              </div>
              <div className="text-sm text-muted">
                Preview frames on your face before you buy — quick and easy.
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Link href="/virtual-try-on" className="btn btn-primary">
              Try it now
            </Link>
          </div>
        </div>
      </section>

      {/* FIND YOUR FRAME QUIZ CTA */}
      <section className="card p-4 md:p-6 border border-[var(--border)] bg-white/95">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 md:h-10 md:w-10 rounded-xl bg-[var(--primary)]/15 flex items-center justify-center text-lg md:text-xl shrink-0">
              🧠
            </div>

            <div>
              <div className="text-sm font-semibold">
                Find your frame (Quiz)
              </div>
              <div className="text-sm text-muted">
                Answer a few questions (or scan your face shape) and we’ll recommend frames from our catalog — then try them on virtually.
              </div>
            </div>
          </div>

          <div className="flex w-full sm:w-auto flex-col sm:flex-row gap-2 sm:items-center">
            <Link
              href="/find-your-frame"
              className="btn btn-primary w-full sm:w-[160px]"
            >
              Start the quiz
            </Link>

            <Link
              href="/virtual-try-on?returnTo=/find-your-frame%3FfromScan%3D1&autoReturn=1"
              className="btn btn-ghost w-full sm:w-[160px]"
            >
              Scan face shape
            </Link>
          </div>
        </div>
      </section>

      {/* PROMO BANNER */}
      {promo && (
        <section className="card overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-3">
            <div className="p-4 md:p-6 md:col-span-1 flex flex-col justify-center">
              <span className="badge">Monthly promo</span>
              <h2 className="mt-2 text-xl md:text-2xl font-semibold">
                {promo.title}
              </h2>

              {promo.subtitle && (
                <p className="text-sm text-muted mt-1">{promo.subtitle}</p>
              )}

              {promo.cta_href && (
                <div className="mt-4">
                  <Link href={promo.cta_href} className="btn btn-primary">
                    {promo.cta_label ?? "Shop now"}
                  </Link>
                </div>
              )}
            </div>

            <div className="md:col-span-2">
              <div className="relative aspect-[16/9] md:aspect-[3/1] bg-[var(--muted)]">
                {promo.image_url && (
                  <Image
                    src={safeUrl(promo.image_url)}
                    alt={promo.title}
                    fill
                    className="object-cover"
                    sizes="(max-width:768px) 100vw, 66vw"
                  />
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      <SectionHeader
        title="Featured this month"
        subtitle={
          featured.length
            ? "Curated by our opticians"
            : "Showing recent picks"
        }
      >
        <Link href="/shop?sort=relevance" className="link-muted">
          View all
        </Link>
      </SectionHeader>

      <FeaturedGrid products={featuredToShow} />

      {newArrivals.length > 0 && (
        <>
          <SectionHeader title="New arrivals" subtitle="Fresh styles just in" />
          <HorizontalRow products={newArrivals} />
        </>
      )}

      {/* QUICK FILTER CHIPS */}
      <section className="card p-3 md:p-4">
        <div className="flex flex-wrap gap-2">
          {[
            { title: "Aviator", href: "/shop?shape=aviator" },
            { title: "Round", href: "/shop?shape=round" },
            { title: "Rectangle", href: "/shop?shape=rectangle" },
            { title: "Cat-eye", href: "/shop?shape=cat-eye" },
            { title: "Metal", href: "/shop?material=metal" },
            { title: "Acetate", href: "/shop?material=acetate" },
            { title: "Titanium", href: "/shop?material=titanium" },
          ].map((c) => (
            <Link key={c.title} href={c.href} className="btn btn-ghost">
              {c.title}
            </Link>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-5">
        <ServiceCard
          title="Eye exams"
          text="Comprehensive checks with reminders."
          emoji="👩‍⚕️"
        />
        <ServiceCard
          title="Lens options"
          text="Blue-light, single-vision, progressives."
          emoji="🔬"
        />
        <ServiceCard
          title="After-care"
          text="Free adjustments & cleaning."
          emoji="🧰"
        />
      </section>

      <section className="card p-5 md:p-6 text-center">
        <h4 className="font-semibold">Have questions? We’re here to help.</h4>
        <p className="text-sm text-muted mt-1">
          Chat with us or visit our store — your perfect pair awaits.
        </p>
        <div className="mt-3">
          <Link href="/shop" className="btn btn-primary">
            Start shopping
          </Link>
        </div>
      </section>
    </div>
  );
}

function SectionHeader(props: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <h3 className="text-lg md:text-xl font-semibold">{props.title}</h3>
        {props.subtitle && (
          <p className="text-sm text-muted">{props.subtitle}</p>
        )}
      </div>
      {props.children}
    </div>
  );
}

function ProductCardMini({ p }: { p: Product }) {
  const src = safeUrl(p.thumbnail, p.image1);
  const attrs = p.shape ? p.shape : p.material ? p.material : p.brand;

  return (
    <Link href={`/product/${p.slug}`} className="no-underline text-inherit">
      <div className="card p-0 overflow-hidden hover:-translate-y-1 transition">
        <div className="relative aspect-square sm:aspect-[4/3] bg-[var(--muted)]">
          <Image
            src={src}
            alt={p.name}
            fill
            className="object-cover"
            sizes="(max-width:640px) 50vw, (max-width:1024px) 33vw, 25vw"
          />
        </div>

        <div className="p-2.5 md:p-3">
          <div className="text-[13px] md:text-sm font-semibold line-clamp-2 leading-5">
            {p.name}
          </div>
          <div className="text-[10px] md:text-[11px] uppercase tracking-wide opacity-70 truncate">
            {p.brand}
          </div>
          <div className="text-[11px] md:text-xs text-muted capitalize truncate">
            {attrs}
          </div>
          <div className="mt-1 font-semibold text-[13px] md:text-sm">
            ₱{Number(p.price).toLocaleString("en-PH")}
          </div>
        </div>
      </div>
    </Link>
  );
}

function FeaturedGrid({ products }: { products: Product[] }) {
  if (!products.length) {
    return (
      <div className="card p-4 text-sm text-muted">
        Mark some products as <span className="badge ml-1">featured</span> to
        display them here.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      {products.map((p) => (
        <ProductCardMini key={p.id} p={p} />
      ))}
    </div>
  );
}

function HorizontalRow({ products }: { products: Product[] }) {
  if (!products.length) return null;

  return (
    <div className="relative">
      <div className="flex gap-3 md:gap-4 overflow-x-auto pb-1 snap-x snap-mandatory">
        {products.map((p) => (
          <div
            key={p.id}
            className="min-w-[170px] max-w-[170px] sm:min-w-[220px] sm:max-w-[220px] snap-start"
          >
            <ProductCardMini p={p} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ServiceCard({
  title,
  text,
  emoji,
}: {
  title: string;
  text: string;
  emoji: string;
}) {
  return (
    <div className="card p-4 md:p-5 flex gap-3">
      <div className="text-xl md:text-2xl">{emoji}</div>
      <div>
        <div className="font-semibold">{title}</div>
        <div className="text-sm text-muted">{text}</div>
      </div>
    </div>
  );
}