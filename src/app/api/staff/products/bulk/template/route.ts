/* =============================================================================
   File: src/app/api/staff/products/bulk/template/route.ts
   Purpose: download CSV header (optionally by ?type=frames/solution/contact-lens/accessory)
   ============================================================================ */
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const type = (url.searchParams.get("type") || "").toLowerCase();

  const base = [
    "name","slug","brand","price","qty","status","featured",
    "product_type","material","shape","category","size_ml","size_count","dosage",
    "primary_image_url","image_urls"
  ];

  const byType: Record<string, string[]> = {
    frames: ["material","shape"],
    solution: ["category","size_ml"],
    "contact-lens": ["category","size_count"],
    accessory: ["category"],
  };

  const header = type && byType[type]
    ? Array.from(new Set([...base, ...byType[type]]))
    : base;

  const csv = header.join(",") + "\n";
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="products_template${type ? `_${type}` : ""}.csv"`,
    },
  });
}
