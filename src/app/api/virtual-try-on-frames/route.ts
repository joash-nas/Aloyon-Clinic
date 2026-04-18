/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/virtual-try-on-frames/route.ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const excludeSlug = (searchParams.get("excludeSlug") || "").trim();

    const db = await getDb();
    const products = db.collection("products");

    const filter: any = {
      product_type: "frames",
      tryonImageId: { $ne: null },
    };
    if (excludeSlug) filter.slug = { $ne: excludeSlug };

    const items = await products
      .find(filter, { projection: { slug: 1, name: 1, tryonImageId: 1 } })
      .limit(50)
      .toArray();

    const frames = items.map((p: any) => ({
      id: String(p._id),
      slug: p.slug,
      name: p.name,
      png: `/api/images/${p.tryonImageId}`,
    }));

    return NextResponse.json({ frames });
  } catch (e: any) {
    console.error("virtual-try-on-frames error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}