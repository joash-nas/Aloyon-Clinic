/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/quiz/frame-recommendations/route.ts

import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  faceShape: z.string().optional().nullable(),
  frameShape: z.string().optional().nullable(),
  material: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  limit: z.number().int().min(1).max(48).optional().default(24),
});

function norm(x: any) {
  return String(x || "").trim().toLowerCase();
}

function arrify(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => String(x));
  return [String(v)];
}

function pickImage(p: any): string | null {
  if (Array.isArray(p.imageIds) && p.imageIds.length > 0) {
    const primary =
      p.primaryImageId && p.imageIds.includes(p.primaryImageId)
        ? p.primaryImageId
        : p.imageIds[0];
    return primary ? `/api/images/${primary}` : null;
  }

  const candidates = [
    p.thumbnail,
    p.image1,
    p.image,
    p.photo,
    ...(Array.isArray(p.images) ? p.images : []),
  ];

  for (const c of candidates) {
    if (!c) continue;
    const s = String(c).trim();
    if (!s || s === "-" || s === "—" || s.toLowerCase() === "n/a") continue;
    return s;
  }

  return null;
}

function isFrameProduct(p: any) {
  const productType = norm(p.product_type);
  const type = norm(p.type);
  const category = norm(p.category);

  if (productType) {
    if (
      productType === "frames" ||
      productType === "frame" ||
      productType.includes("frame")
    ) {
      return true;
    }
    return false;
  }

  if (type) {
    if (type === "frames" || type === "frame" || type.includes("frame")) {
      return true;
    }
    return false;
  }

  if (category) {
    if (category.includes("frame") || category.includes("eyewear")) return true;
    return false;
  }

  const name = norm(p.name);
  const tags = arrify(p.tags).map(norm);

  if (
    tags.some(
      (t) =>
        t === "frames" ||
        t === "frame" ||
        t.includes("frame") ||
        t.includes("eyewear")
    )
  ) {
    return true;
  }

  if (
    name.includes("frame") ||
    name.includes("eyeglass") ||
    name.includes("eyewear")
  ) {
    return true;
  }

  return false;
}

function isFaceShapeCompatible(faceShape: string, frameShape: string) {
  if (!faceShape || !frameShape) return false;

  if (
    faceShape === "round" &&
    ["rectangle", "square", "browline", "cat-eye", "geometric", "wayfarer"].includes(
      frameShape
    )
  ) {
    return true;
  }

  if (
    faceShape === "square" &&
    ["round", "oval", "aviator"].includes(frameShape)
  ) {
    return true;
  }

  if (faceShape === "oval") {
    return true;
  }

  if (
    faceShape === "heart" &&
    ["oval", "round", "aviator", "browline"].includes(frameShape)
  ) {
    return true;
  }

  if (
    faceShape === "diamond" &&
    ["oval", "cat-eye", "browline", "round"].includes(frameShape)
  ) {
    return true;
  }

  if (
    faceShape === "triangle" &&
    ["browline", "cat-eye", "aviator"].includes(frameShape)
  ) {
    return true;
  }

  return false;
}

/**
 * Match score is a normalized percentage.
 *
 * Current reliable scoring variables:
 * - Frame shape = 40%
 * - Material = 25%
 * - color - 15%
 * - Face-shape compatibility = 20%
 *
 */

function computeMatchScore(p: any, prefs: z.infer<typeof BodySchema>) {
  const faceShape = norm(prefs.faceShape);
  const frameShape = norm(prefs.frameShape);
  const material = norm(prefs.material);
  const color = norm(prefs.color);

  const pFrameShape = norm(p.frameShape || p.frame_shape || p.shape);
  const pMaterial = norm(p.material || p.frameMaterial || p.frame_material);
  const pColor = norm(p.color || p.frameColor || p.frame_color);

  const tags = arrify(p.tags).map(norm);

  let earned = 0;
  let possible = 0;

  // Frame shape = 40%
  if (frameShape) {
    possible += 40;
    if (pFrameShape === frameShape || tags.includes(frameShape)) {
      earned += 40;
    }
  }

  // Material = 25%
  if (material) {
    possible += 25;
    if (pMaterial === material || tags.includes(material)) {
      earned += 25;
    }
  }

  // Color = 15%
  if (color) {
    possible += 15;
    if (pColor === color || tags.includes(color)) {
      earned += 15;
    }
  }

  // Face-shape compatibility = 20%
  if (faceShape) {
    possible += 20;
    if (isFaceShapeCompatible(faceShape, pFrameShape)) {
      earned += 20;
    }
  }

  if (possible === 0) return 0;

  return Math.round((earned / possible) * 100);
}

function getMatchLabel(score: number) {
  if (score >= 80) return "Highly Recommended";
  if (score >= 60) return "Recommended";
  if (score >= 40) return "Moderate Match";
  return "Low Match";
}

export async function POST(req: Request) {
  try {
    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const prefs = parsed.data;
    const wantedShape = norm(prefs.frameShape);
    const wantedMaterial = norm(prefs.material);

    const db = await getDb();
    const col = db.collection("products") as any;

    const docs = await col
      .find({
        status: "active",
        $or: [{ product_type: "frames" }, { product_type: { $exists: false } }],
      })
      .limit(400)
      .toArray();

    const frames = docs.filter((p: any) => isFrameProduct(p));

    // IMPORTANT:
    // Score ALL frame products so users can see different match groups
    // like 100%, 70%, 50%, 20%, instead of only one narrow subset.
    const candidates = frames;

    type Ranked = { p: any; s: number };

    const ranked: Ranked[] = candidates
      .map((p: any): Ranked => {
        const s = computeMatchScore(p, prefs);
        return { p, s };
      })
      .filter((x: Ranked) => x.s > 0)
      .sort((a: Ranked, b: Ranked) => {
        // 1) Higher percentage first
        if (b.s !== a.s) return b.s - a.s;

        // 2) Exact shape match first
        const aShape = norm(a.p.frameShape || a.p.frame_shape || a.p.shape);
        const bShape = norm(b.p.frameShape || b.p.frame_shape || b.p.shape);

        const aShapeExact = wantedShape && aShape === wantedShape ? 1 : 0;
        const bShapeExact = wantedShape && bShape === wantedShape ? 1 : 0;

        if (bShapeExact !== aShapeExact) return bShapeExact - aShapeExact;

        // 3) Exact material match next
        const aMat = norm(a.p.material || a.p.frameMaterial || a.p.frame_material);
        const bMat = norm(b.p.material || b.p.frameMaterial || b.p.frame_material);

        const aMatExact = wantedMaterial && aMat === wantedMaterial ? 1 : 0;
        const bMatExact = wantedMaterial && bMat === wantedMaterial ? 1 : 0;

        if (bMatExact !== aMatExact) return bMatExact - aMatExact;

        // 4) Lower price first
        return Number(a.p.price || 0) - Number(b.p.price || 0);
      });

    const top = ranked.slice(0, prefs.limit).map(({ p, s }: Ranked) => ({
      id: String(p._id),
      slug: String(p.slug || ""),
      name: String(p.name || "Frame"),
      price: Number(p.price || 0),
      image: pickImage(p),
      score: s,
      matchLabel: getMatchLabel(s),
      frameShape: p.frameShape || p.frame_shape || p.shape || null,
      material: p.material || p.frameMaterial || p.frame_material || null,
      colors: p.color ? [p.color] : p.colors || null,
    }));

    return NextResponse.json({ ok: true, items: top });
  } catch (e: any) {
    console.error("[POST /api/quiz/frame-recommendations] error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}