"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";

export type FeaturedItem = {
  slug: string;
  name: string;
  brand?: string | null;
  price: number;
  thumbnail?: string | null;
};

export default function FeaturedRail({ items }: { items: FeaturedItem[] }) {
  const scroller = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    const el = scroller.current;
    if (!el) return;
    const delta = Math.min(560, Math.max(280, el.clientWidth * 0.8));
    el.scrollBy({ left: dir === "left" ? -delta : delta, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Featured this month</h2>
        <Link href="/shop" className="text-sm hover:underline">View all</Link>
      </div>

      {!items?.length ? (
        <div className="rounded-2xl border p-6 text-sm text-muted">
          Mark some products as <code>featured</code> to display them here.
        </div>
      ) : (
        <div className="relative">
          <button
            aria-label="Scroll left"
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 rounded-full border bg-white/80 backdrop-blur px-3 py-2 shadow hover:shadow-md"
            onClick={() => scroll("left")}
          >
            ◀
          </button>

          <div ref={scroller} className="flex gap-4 overflow-x-auto scroll-smooth pb-2 pr-2">
            {items.map((p) => (
              <Link
                key={p.slug}
                href={`/product/${p.slug}`}
                className="min-w-[240px] w-[240px] rounded-xl border hover:shadow transition overflow-hidden bg-white"
              >
                <div className="relative aspect-[4/3] bg-[--muted]">
                  {p.thumbnail ? (
                    <Image
                      src={p.thumbnail}
                      alt={p.name}
                      fill
                      className="object-cover"
                      sizes="240px"
                    />
                  ) : (
                    <div className="w-full h-full grid place-content-center text-xs text-muted">
                      No image
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <div className="text-xs uppercase tracking-wide text-muted">
                    {p.brand || "—"}
                  </div>
                  <div className="line-clamp-1">{p.name}</div>
                  <div className="mt-1 font-medium">₱{p.price.toLocaleString("en-PH")}</div>
                </div>
              </Link>
            ))}
          </div>

          <button
            aria-label="Scroll right"
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 rounded-full border bg-white/80 backdrop-blur px-3 py-2 shadow hover:shadow-md"
            onClick={() => scroll("right")}
          >
            ▶
          </button>
        </div>
      )}
    </div>
  );
}
