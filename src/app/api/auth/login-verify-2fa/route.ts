/* eslint-disable @typescript-eslint/no-explicit-any */
/* File: src/app/api/auth/login-verify-2fa/route.ts
   Purpose: Verify 2FA email code and mark user as recently verified.
*/

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { compare } from "bcrypt";

const BodySchema = z.object({
  token: z.string().min(1),
  code: z.string().min(4).max(10),
});

const EMAIL_TOKEN_SECRET = process.env.EMAIL_TOKEN_SECRET;

if (!EMAIL_TOKEN_SECRET) {
  console.warn(
    "[login-verify-2fa] EMAIL_TOKEN_SECRET is not set. 2FA verification will fail."
  );
}

// POST /api/auth/login-verify-2fa
export async function POST(req: NextRequest) {
  if (!EMAIL_TOKEN_SECRET) {
    return NextResponse.json(
      { ok: false, error: "2FA is not configured on the server." },
      { status: 500 }
    );
  }

  let parsed;
  // read and validate request body
  try {
    const body = await req.json();
    parsed = BodySchema.safeParse(body);
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid 2FA code." },
      { status: 400 }
    );
  }

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid 2FA code." },
      { status: 400 }
    );
  }

  const { token, code } = parsed.data;

  // verify short-lived 2FA token
  let payload: any;
  try {
    payload = jwt.verify(token, EMAIL_TOKEN_SECRET);
  } catch {
    return NextResponse.json(
      { ok: false, error: "2FA code has expired or is invalid." },
      { status: 400 }
    );
  }

  if (!payload || payload.kind !== "2fa" || !payload.uid) {
    return NextResponse.json(
      { ok: false, error: "Invalid 2FA token." },
      { status: 400 }
    );
  }

  const userId = payload.uid as string;

  const db = await getDb();
  const users = db.collection("users");

  // load stored 2FA code for this user
  const user: any = await users.findOne(
    { _id: new ObjectId(userId) },
    {
      projection: {
        email: 1,
        twoFactorCodeHash: 1,
        twoFactorCodeExpiresAt: 1,
      },
    }
  );

  if (!user?.twoFactorCodeHash || !user.twoFactorCodeExpiresAt) {
    return NextResponse.json(
      { ok: false, error: "2FA code is no longer valid." },
      { status: 400 }
    );
  }

  // check expiry
  const expiresAt = new Date(user.twoFactorCodeExpiresAt);
  if (expiresAt.getTime() < Date.now()) {
    await users.updateOne(
      { _id: user._id },
      { $unset: { twoFactorCodeHash: "", twoFactorCodeExpiresAt: "" } }
    );
    return NextResponse.json(
      { ok: false, error: "2FA code has expired." },
      { status: 400 }
    );
  }

  // compare plain code with stored hash
  const ok = await compare(code, user.twoFactorCodeHash);
  if (!ok) {
    return NextResponse.json(
      { ok: false, error: "Incorrect 2FA code." },
      { status: 400 }
    );
  }

  // update last verified timestamp and clear code fields
  await users.updateOne(
    { _id: user._id },
    {
      $set: {
        twoFactorLastVerifiedAt: new Date(),
      },
      $unset: {
        twoFactorCodeHash: "",
        twoFactorCodeExpiresAt: "",
      },
    }
  );

  return NextResponse.json({
    ok: true,
    email: user.email,
  });
}
