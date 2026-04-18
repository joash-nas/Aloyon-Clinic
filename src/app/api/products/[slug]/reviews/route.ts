// src/app/api/products/[slug]/reviews/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { type Sort } from "mongodb";
import { z } from "zod";
import { getDb } from "@/lib/mongodb";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const dynamic = "force-dynamic";

const ReviewInput = z.object({
  rating: z.number().min(1).max(5),
  comment: z.string().trim().min(3).max(500),
  anonymous: z.boolean().optional().default(false),
});

type ReviewDoc = {
  productId: string;
  productSlug: string;
  userId: string;
  name: string;
  rating: number;
  comment: string;
  anonymous?: boolean;
  createdAt: Date;
};

type UserDoc = {
  _id?: unknown;
  id?: string;
  email?: string | null;
  fullName?: string | null;
  name?: string | null;
};

function getSort(sort: string | null): Sort {
  switch (sort) {
    case "oldest":
      return { createdAt: 1 as const };
    case "highest":
      return { rating: -1 as const, createdAt: -1 as const };
    case "lowest":
      return { rating: 1 as const, createdAt: -1 as const };
    case "newest":
    default:
      return { createdAt: -1 as const };
  }
}

function cleanName(value?: string | null) {
  const v = String(value || "").trim();
  return v.length > 0 ? v : null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, Number(searchParams.get("page") || "1"));
    const limitRaw = Number(searchParams.get("limit") || "5");
    const limit = Math.min(20, Math.max(1, limitRaw));
    const sort = searchParams.get("sort") || "newest";

    const db = await getDb();

    const product = await db.collection("products").findOne({ slug });
    if (!product) {
      return NextResponse.json(
        { ok: false, error: "Product not found." },
        { status: 404 }
      );
    }

    const filter = { productSlug: slug };

    const total = await db
      .collection<ReviewDoc>("reviews")
      .countDocuments(filter);

    const reviews = await db
      .collection<ReviewDoc>("reviews")
      .find(filter)
      .sort(getSort(sort))
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    const allReviews = await db
      .collection<ReviewDoc>("reviews")
      .find(filter)
      .toArray();

    const avg =
      allReviews.length > 0
        ? allReviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) /
          allReviews.length
        : 0;

    return NextResponse.json({
      ok: true,
      reviews: reviews.map((r: any) => ({
        id: String(r._id),
        userId: r.userId,
        name: r.anonymous
          ? "Anonymous"
          : cleanName(r.name) ||
            cleanName(r.userName) ||
            "Verified Buyer",
        rating: r.rating,
        comment: r.comment,
        anonymous: !!r.anonymous,
        createdAt: r.createdAt,
      })),
      summary: {
        averageRating: allReviews.length > 0 ? Number(avg.toFixed(1)) : 0,
        reviewsCount: total,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        sort,
      },
    });
  } catch (error) {
    console.error("GET /api/products/[slug]/reviews error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to load reviews." },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { ok: false, error: "Please sign in first." },
        { status: 401 }
      );
    }

    const { slug } = await params;
    const body = await req.json();
    const parsed = ReviewInput.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid review input." },
        { status: 400 }
      );
    }

    const db = await getDb();

    const product = await db.collection("products").findOne({
      slug,
      status: "active",
    });

    if (!product) {
      return NextResponse.json(
        { ok: false, error: "Product not found." },
        { status: 404 }
      );
    }

    const sessionUserId =
      (session.user as any).id ||
      (session.user as any)._id ||
      session.user.email ||
      "";

    const userEmail = session.user.email || "";

    if (!sessionUserId) {
      return NextResponse.json(
        { ok: false, error: "Unable to identify user." },
        { status: 400 }
      );
    }

    const userDoc = await db.collection<UserDoc>("users").findOne({
      $or: [{ id: sessionUserId }, { email: userEmail }],
    });

    const resolvedName =
      cleanName(userDoc?.fullName) ||
      cleanName(userDoc?.name) ||
      cleanName(session.user.name) ||
      cleanName(userEmail.split("@")[0]) ||
      "Verified Buyer";

    const productId = String((product as any)._id);
    const productName = String((product as any).name || "");

    const hasPurchased = await db.collection("orders").findOne({
      status: { $in: ["pending", "paid", "ready", "completed", "claimed"] },
      $and: [
        {
          $or: [
            { userId: sessionUserId },
            { patientId: sessionUserId },
            { customerId: sessionUserId },
            { userEmail },
            { email: userEmail },
          ],
        },
        {
          $or: [
            { items: { $elemMatch: { productId } } },
            { items: { $elemMatch: { id: productId } } },
            { items: { $elemMatch: { _id: productId } } },
            { items: { $elemMatch: { slug } } },
            { items: { $elemMatch: { name: productName } } },
          ],
        },
      ],
    });

    if (!hasPurchased) {
      return NextResponse.json(
        {
          ok: false,
          error: "Only buyers can leave a review for this product.",
        },
        { status: 403 }
      );
    }

    // one user = one review per product
    const existing = await db.collection<ReviewDoc>("reviews").findOne({
      productSlug: slug,
      userId: sessionUserId,
    });

    if (existing) {
      return NextResponse.json(
        {
          ok: false,
          error: "You have already submitted a review for this item.",
        },
        { status: 409 }
      );
    }

    await db.collection<ReviewDoc>("reviews").insertOne({
      productId,
      productSlug: slug,
      userId: sessionUserId,
      name: resolvedName,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
      anonymous: !!parsed.data.anonymous,
      createdAt: new Date(),
    });

    const allReviews = await db
      .collection<ReviewDoc>("reviews")
      .find({ productSlug: slug })
      .toArray();

    const reviewsCount = allReviews.length;
    const averageRating =
      reviewsCount > 0
        ? Number(
            (
              allReviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) /
              reviewsCount
            ).toFixed(1)
          )
        : 0;

    await db.collection("products").updateOne(
      { _id: (product as any)._id },
      {
        $set: {
          rating: averageRating,
          reviews_count: reviewsCount,
        },
      }
    );

    return NextResponse.json({
      ok: true,
      message: "Review submitted.",
      summary: {
        averageRating,
        reviewsCount,
      },
    });
  } catch (error) {
    console.error("POST /api/products/[slug]/reviews error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to submit review." },
      { status: 500 }
    );
  }
}