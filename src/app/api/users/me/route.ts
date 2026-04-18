// src/app/api/users/me/route.ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { ObjectId } from "mongodb";
import { z } from "zod";

const SexEnum = z.enum(["male", "female", "other", "prefer_not_to_say"]);

const ProfileSchema = z.object({
  fullName: z.string().nullable().optional(),
  dob: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  sex: SexEnum.nullable().optional(),
});

const BodySchema = z.object({
  name: z.string().min(1),
  profile: ProfileSchema,
});

// GET /api/users/me
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const db = await getDb();
  const user = await db.collection("users").findOne(
    { _id: new ObjectId(session.user.id) },
    {
      projection: {
        email: 1,
        name: 1,
        role: 1,
        profile: 1,
        createdAt: 1,
        emailVerified: 1,
      },
    }
  );

  if (!user) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  // include string id for client
  return NextResponse.json({
    ok: true,
    user: {
      ...user,
      id: user._id?.toString?.() ?? String(session.user.id),
    },
  });
}

// PUT /api/users/me
export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  let parsed;
  try {
    const body = await req.json();
    parsed = BodySchema.safeParse(body);
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });
  }

  const { name, profile } = parsed.data;

  const db = await getDb();
  const users = db.collection("users");

  await users.updateOne(
    { _id: new ObjectId(session.user.id) },
    {
      $set: {
        name,
        "profile.fullName": profile.fullName ?? name,
        "profile.dob": profile.dob ?? null,
        "profile.phone": profile.phone ?? null,
        "profile.address": profile.address ?? null,
        "profile.sex": profile.sex ?? null,
        updatedAt: new Date(),
      },
    }
  );

  return NextResponse.json({ ok: true });
}
