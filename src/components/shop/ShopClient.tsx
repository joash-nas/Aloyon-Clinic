// src/components/shop/ShopClient.tsx 
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QuickAddToCart from "./QuickAddToCart";
import MultiSelect from "@/components/ui/MultiSelect";
import type { ProductCard } from "@/types/product";

type SortOption = "relevance" | "price-asc" | "price-desc" | "name-asc";
type Density = "comfort" | "compact" | "list";

type Props = {
  initialProducts: ProductCard[];
  total: number;
  page: number;
  limit: number;
  qFromUrl: string;
  allProductTypes: string[];
  allBrands: string[];
  typeFromUrl: string;
  sortFromUrl: SortOption;
  materialFromUrl: string;
  shapeFromUrl: string;
  brandsFromUrl: string[];
  densityFromUrl: Density;
};

const uniq = (arr: (string | null | undefined)[]) =>
  Array.from(new Set(arr.filter(Boolean) as string[])).sort((a, b) =>
    a.localeCompare(b)
  );

const field =
  "rounded-xl px-3 py-2 ring-1 ring-[var(--border)] bg-white/70 dark:bg-white/5 outline-none transition hover:shadow-sm focus:ring-[var(--primary)]";

const safeImg = (a?: string | null, b?: string | null) => {
  const pick = (s?: string | null) => (s && s.trim() !== "" ? s : null);
  return pick(a) ?? pick(b) ?? "/placeholder.png";
};

function titleize(value: string) {
  return value
    .split(/[- ]/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export default function ShopClient({
  initialProducts,
  total,
  page,
  limit,
  qFromUrl,
  allProductTypes,
  allBrands,
  typeFromUrl,
  sortFromUrl,
  materialFromUrl,
  shapeFromUrl,
  brandsFromUrl,
  densityFromUrl,
}: Props) {
  const router = useRouter();

  const [qInput, setQInput] = useState(qFromUrl ?? "");
  const [typeUi, setTypeUi] = useState(typeFromUrl || "all");
  const [brandsSel, setBrandsSel] = useState<string[]>(brandsFromUrl ?? []);
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [sort, setSort] = useState<SortOption>(sortFromUrl || "relevance");
  const [density, setDensity] = useState<Density>(densityFromUrl || "comfort");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => {
    setQInput(qFromUrl ?? "");
  }, [qFromUrl]);

  useEffect(() => {
    setTypeUi(typeFromUrl || "all");
  }, [typeFromUrl]);

  useEffect(() => {
    setSort(sortFromUrl || "relevance");
  }, [sortFromUrl]);

  useEffect(() => {
    setBrandsSel(brandsFromUrl ?? []);
  }, [brandsFromUrl]);

  useEffect(() => {
    setDensity(densityFromUrl || "comfort");
  }, [densityFromUrl]);

  const productTypes = useMemo(() => uniq(allProductTypes), [allProductTypes]);
  const brands = useMemo(() => uniq(allBrands), [allBrands]);

  const filtered = useMemo(() => {
    let items = initialProducts.slice();

    if (inStockOnly) {
      items = items.filter((p) => p.qty > 0);
    }

    return items;
  }, [initialProducts, inStockOnly]);

  const gridCols =
    density === "list"
      ? "grid-cols-1"
      : density === "compact"
      ? "grid-cols-3 md:grid-cols-4 xl:grid-cols-5"
      : "grid-cols-2 md:grid-cols-4";

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const buildUrl = ({
    nextQ,
    nextType,
    nextSort,
    nextPage = 1,
    nextBrands,
    nextDensity,
    clearMaterial = false,
    clearShape = false,
  }: {
    nextQ?: string;
    nextType?: string;
    nextSort?: SortOption;
    nextPage?: number;
    nextBrands?: string[];
    nextDensity?: Density;
    clearMaterial?: boolean;
    clearShape?: boolean;
  }) => {
    const params = new URLSearchParams();

    const finalQ = (nextQ ?? qInput).trim();
    const finalType = nextType ?? typeUi;
    const finalSort = nextSort ?? sort;
    const finalBrands = nextBrands ?? brandsSel;
    const finalDensity = nextDensity ?? density;

    if (finalQ) params.set("q", finalQ);
    if (finalType && finalType !== "all") params.set("type", finalType);
    if (finalSort && finalSort !== "relevance") params.set("sort", finalSort);
    if (finalBrands.length) params.set("brand", finalBrands.join(","));
    if (finalDensity && finalDensity !== "comfort") {
      params.set("density", finalDensity);
    }

    if (!clearMaterial && materialFromUrl) {
      params.set("material", materialFromUrl);
    }

    if (!clearShape && shapeFromUrl) {
      params.set("shape", shapeFromUrl);
    }

    params.set("page", String(nextPage));

    const qs = params.toString();
    return qs ? `/shop?${qs}` : "/shop";
  };

  useEffect(() => {
    if (
      qInput === (qFromUrl ?? "") &&
      sort === (sortFromUrl || "relevance") &&
      typeUi === (typeFromUrl || "all") &&
      density === (densityFromUrl || "comfort") &&
      JSON.stringify(brandsSel) === JSON.stringify(brandsFromUrl || [])
    ) {
      return;
    }

    const t = setTimeout(() => {
      router.replace(
        buildUrl({
          nextQ: qInput,
          nextType: typeUi,
          nextSort: sort,
          nextBrands: brandsSel,
          nextDensity: density,
          nextPage: 1,
        }),
        { scroll: true }
      );
    }, 350);

    return () => clearTimeout(t);
  }, [
    qInput,
    qFromUrl,
    router,
    sort,
    sortFromUrl,
    typeUi,
    typeFromUrl,
    brandsSel,
    brandsFromUrl,
    density,
    densityFromUrl,
    materialFromUrl,
    shapeFromUrl,
  ]);

  const paginationParams = new URLSearchParams();
  if (qFromUrl) paginationParams.set("q", qFromUrl);
  if (typeFromUrl && typeFromUrl !== "all") paginationParams.set("type", typeFromUrl);
  if (sortFromUrl && sortFromUrl !== "relevance") paginationParams.set("sort", sortFromUrl);
  if (materialFromUrl) paginationParams.set("material", materialFromUrl);
  if (shapeFromUrl) paginationParams.set("shape", shapeFromUrl);
  if (brandsSel.length) paginationParams.set("brand", brandsSel.join(","));
  if (density && density !== "comfort") paginationParams.set("density", density);

  const baseQS = paginationParams.toString();

  const makePageHref = (p: number) =>
    baseQS ? `/shop?page=${p}&${baseQS}` : `/shop?page=${p}`;

  const activeFilterCount =
    (typeUi !== "all" ? 1 : 0) +
    (brandsSel.length > 0 ? 1 : 0) +
    (inStockOnly ? 1 : 0) +
    (materialFromUrl ? 1 : 0) +
    (shapeFromUrl ? 1 : 0);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold">Shop</h2>
        <p className="text-sm text-muted">
          Frames, eyedrops, contact lenses, accessories.
        </p>

        {(materialFromUrl || shapeFromUrl) && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {materialFromUrl ? (
              <span className="badge">Material: {titleize(materialFromUrl)}</span>
            ) : null}
            {shapeFromUrl ? (
              <span className="badge">Shape: {titleize(shapeFromUrl)}</span>
            ) : null}
            <Link href="/shop" className="link-muted text-sm">
              Clear quick filter
            </Link>
          </div>
        )}
      </div>

      <div className="lg:hidden space-y-3">
        <input
          className={`${field} w-full`}
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setQInput("");
          }}
          placeholder="Search products or brands..."
          aria-label="Search products"
        />

        <div className="sticky top-2 z-20 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur p-2 shadow-sm">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileFiltersOpen((v) => !v)}
              className="flex-1 rounded-xl px-3 py-2 text-sm ring-1 ring-[var(--border)] bg-white/70 dark:bg-white/5"
            >
              Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </button>

            <select
              className={`${field} min-w-0 flex-1 text-sm`}
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              aria-label="Sort products"
            >
              <option value="relevance">Sort</option>
              <option value="price-asc">Low → High</option>
              <option value="price-desc">High → Low</option>
              <option value="name-asc">A–Z</option>
            </select>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-muted px-1 whitespace-nowrap">
              {filtered.length} item{filtered.length !== 1 ? "s" : ""}
            </span>

            <div className="ml-auto inline-flex rounded-xl ring-1 ring-[var(--border)] overflow-hidden">
              <button
                type="button"
                onClick={() => setDensity("comfort")}
                className={`px-3 py-2 text-xs ${
                  density === "comfort"
                    ? "bg-[var(--primary)] text-black"
                    : "bg-white/70 dark:bg-white/5"
                }`}
                aria-pressed={density === "comfort"}
              >
                Comfort
              </button>
              <button
                type="button"
                onClick={() => setDensity("compact")}
                className={`px-3 py-2 text-xs border-l border-[var(--border)] ${
                  density === "compact"
                    ? "bg-[var(--primary)] text-black"
                    : "bg-white/70 dark:bg-white/5"
                }`}
                aria-pressed={density === "compact"}
              >
                Compact
              </button>
              <button
                type="button"
                onClick={() => setDensity("list")}
                className={`px-3 py-2 text-xs border-l border-[var(--border)] ${
                  density === "list"
                    ? "bg-[var(--primary)] text-black"
                    : "bg-white/70 dark:bg-white/5"
                }`}
                aria-pressed={density === "list"}
              >
                List
              </button>
            </div>
          </div>

          {mobileFiltersOpen && (
            <div className="mt-3 space-y-2 border-t border-[var(--border)] pt-3">
              <select
                className={`${field} w-full`}
                value={typeUi}
                onChange={(e) => setTypeUi(e.target.value)}
                aria-label="Filter by type"
              >
                <option value="all">All types</option>
                {productTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              <div className="w-full">
                <MultiSelect
                  options={brands}
                  value={brandsSel}
                  onChange={setBrandsSel}
                  placeholder="Brand: All"
                  isMulti
                  instanceId="brand-mobile"
                />
              </div>

              <label className="flex items-center gap-2 text-sm px-3 py-2 rounded-xl ring-1 ring-[var(--border)] bg-white/70 dark:bg-white/5 select-none">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => setInStockOnly(e.target.checked)}
                />
                In stock only
              </label>

              <Link
                className="btn btn-ghost w-full justify-center"
                href="/shop"
                onClick={() => {
                  setBrandsSel([]);
                  setInStockOnly(false);
                  setMobileFiltersOpen(false);
                  setDensity("comfort");
                }}
              >
                Reset filters
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="hidden lg:block card p-4 md:p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 w-full">
          <input
            className={`${field} w-full xl:w-[22rem]`}
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setQInput("");
            }}
            placeholder="Search products or brands..."
            aria-label="Search products"
          />

          <select
            className={`${field} min-w-[10rem]`}
            value={typeUi}
            onChange={(e) => setTypeUi(e.target.value)}
            aria-label="Filter by type"
          >
            <option value="all">Type: All</option>
            {productTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <div className="min-w-[12rem] max-w-[14rem]">
            <MultiSelect
              options={brands}
              value={brandsSel}
              onChange={setBrandsSel}
              placeholder="Brand: All"
              isMulti
              instanceId="brand-desktop"
            />
          </div>

          <label className="flex items-center gap-2 text-sm px-3 py-2 rounded-xl ring-1 ring-[var(--border)] bg-white/70 dark:bg-white/5 select-none">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => setInStockOnly(e.target.checked)}
            />
            In stock only
          </label>

          <div className="ml-auto flex items-center gap-2">
            <select
              className={`${field} w-[11rem]`}
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              aria-label="Sort products"
            >
              <option value="relevance">Sort: Relevance</option>
              <option value="price-asc">Price: Low → High</option>
              <option value="price-desc">Price: High → Low</option>
              <option value="name-asc">Name: A–Z</option>
            </select>

            <div className="inline-flex rounded-xl ring-1 ring-[var(--border)] overflow-hidden">
              <button
                type="button"
                onClick={() => setDensity("comfort")}
                className={`px-3 py-2 text-sm ${
                  density === "comfort"
                    ? "bg-[var(--primary)] text-black"
                    : "bg-white/70 dark:bg-white/5"
                }`}
              >
                Comfort
              </button>
              <button
                type="button"
                onClick={() => setDensity("compact")}
                className={`px-3 py-2 text-sm border-l border-[var(--border)] ${
                  density === "compact"
                    ? "bg-[var(--primary)] text-black"
                    : "bg-white/70 dark:bg-white/5"
                }`}
              >
                Compact
              </button>
              <button
                type="button"
                onClick={() => setDensity("list")}
                className={`px-3 py-2 text-sm border-l border-[var(--border)] ${
                  density === "list"
                    ? "bg-[var(--primary)] text-black"
                    : "bg-white/70 dark:bg-white/5"
                }`}
              >
                List
              </button>
            </div>

            <Link
              className="btn btn-ghost"
              href="/shop"
              onClick={() => {
                setBrandsSel([]);
                setDensity("comfort");
              }}
            >
              Reset
            </Link>
          </div>
        </div>
      </div>

      <div className={`grid ${gridCols} gap-3 md:gap-5`}>
        {filtered.map((p) => {
          const img = safeImg(p.thumbnail, p.image1);
          const attrs =
            p.product_type === "eyedrops"
              ? [p.size_ml ? `${p.size_ml} ml` : null, p.dosage]
              : p.product_type === "accessory"
              ? [p.category]
              : p.product_type === "solution"
              ? [p.size_ml ? `${p.size_ml} ml` : null]
              : p.product_type === "contact-lens"
              ? [p.category]
              : [p.material];

          const isList = density === "list";
          const isCompact = density === "compact";
          const compactBtn =
            "inline-flex items-center justify-center rounded-full px-3 py-2 text-[11px] font-medium bg-neutral-900 text-white";
          const normalBtn =
            "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium bg-neutral-900 text-white";

          return (
            <div
              key={p.id}
              className={`card overflow-hidden transition shadow-[0_2px_10px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] ${
                isList ? "p-0 flex flex-row" : "p-0"
              }`}
            >
              <Link
                href={`/product/${p.slug}`}
                className={`no-underline text-inherit ${isList ? "w-28 sm:w-40 shrink-0" : ""}`}
              >
                <div
                  className={`bg-[var(--muted)] ${
                    isList
                      ? "h-full min-h-[120px]"
                      : isCompact
                      ? "aspect-square"
                      : "aspect-[4/3]"
                  }`}
                >
                  <img src={img} alt={p.name} className="w-full h-full object-cover" />
                </div>
              </Link>

              <div
                className={`${
                  isList
                    ? "flex-1 p-3 sm:p-4"
                    : isCompact
                    ? "p-2 sm:p-3"
                    : "p-3 sm:p-4"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3
                      className={`font-semibold text-balance ${
                        isCompact
                          ? "text-[12px] leading-4 line-clamp-2"
                          : "text-sm sm:text-base truncate"
                      }`}
                    >
                      {p.name}
                    </h3>

                    {!isCompact && (
                      <div className="text-[10px] sm:text-[11px] uppercase tracking-wide opacity-70 truncate">
                        {p.brand}
                      </div>
                    )}

                    <div
                      className={`text-muted capitalize ${
                        isCompact
                          ? "text-[11px] mt-1 truncate"
                          : "text-xs sm:text-sm truncate"
                      }`}
                    >
                      {attrs.filter(Boolean).join(" • ") || "—"}
                    </div>

                    {!isCompact && p.qty <= 5 && p.qty > 0 && (
                      <div
                        className="text-[10px] sm:text-[11px] mt-1"
                        style={{ color: "#b10d0d" }}
                      >
                        Low stock
                      </div>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <div
                      className={`font-semibold ${
                        isCompact ? "text-[12px]" : "text-sm sm:text-base"
                      }`}
                    >
                      ₱{Number(p.price).toLocaleString("en-PH")}
                    </div>
                  </div>
                </div>

                <div
                  className={`${
                    isCompact
                      ? "mt-2 flex flex-col gap-2"
                      : "mt-3 flex items-center justify-between gap-2"
                  }`}
                >
                  {!isCompact && (
                    <span className="text-[11px] sm:text-xs text-muted">
                      {p.qty > 0 ? `In stock: ${p.qty}` : "Out of stock"}
                    </span>
                  )}

                  {p.qty > 0 ? (
                    isCompact ? (
                      <button type="button" className={`${compactBtn} w-full`}>
                        Add
                      </button>
                    ) : (
                      <QuickAddToCart
                        productId={p.id}
                        name={p.name}
                        price={Number(p.price)}
                        image={img}
                        inStock={true}
                        maxQty={p.qty}
                      />
                    )
                  ) : (
                    <button
                      className={`${
                        isCompact ? compactBtn : normalBtn
                      } w-full opacity-60 cursor-not-allowed`}
                      disabled
                    >
                      Out
                    </button>
                  )}
                </div>

                {!isCompact && (
                  <div className="text-[11px] sm:text-xs text-muted mt-2">
                    ★ {Number(p.rating ?? 0).toFixed(1)} ({p.reviews_count ?? 0})
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="card p-6 shadow-sm col-span-full">
            <div className="text-sm text-muted">No products match your filters.</div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-3 pt-2">
        <a
          className={`btn btn-ghost ${!canPrev ? "pointer-events-none opacity-50" : ""}`}
          href={canPrev ? makePageHref(page - 1) : "#"}
        >
          ← Prev
        </a>

        <div className="text-xs text-muted">
          Page {page} of {totalPages}
        </div>

        <a
          className={`btn btn-ghost ${!canNext ? "pointer-events-none opacity-50" : ""}`}
          href={canNext ? makePageHref(page + 1) : "#"}
        >
          Next →
        </a>
      </div>
    </div>
  );
}