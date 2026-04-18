/* eslint-disable @typescript-eslint/no-explicit-any */

// src/app/api/virtual-try-on-product/route.ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = (searchParams.get("slug") || "").trim();

    if (!slug) {
      return NextResponse.json({ error: "Missing slug" }, { status: 400 });
    }

    const db = await getDb();
    const products = db.collection("products");

    // IMPORTANT: uses tryonImageId (same name your ProductForm saves)
    const product = await products.findOne(
      { slug },
      { projection: { slug: 1, name: 1, tryonImageId: 1 } }
    );

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (!product.tryonImageId) {
      return NextResponse.json(
        { error: "Try-on PNG not configured" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      slug: product.slug,
      name: product.name,
      png: `/api/images/${product.tryonImageId}`,
    });
  } catch (e: any) {
    console.error("virtual-try-on-product error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}