// src/app/api/auth/reset-password/route.ts
/* Purpose: Complete password reset using a valid reset token. */

import { NextResponse } from "next/server";
import { z } from "zod";
import { hash } from "bcrypt";
import { getDb } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Strong password rules (same as register)
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password is too long.")
  .refine((v) => !/\s/.test(v), "Password must not contain spaces.")
  .refine((v) => /[a-z]/.test(v), "Password must contain a lowercase letter.")
  .refine((v) => /[A-Z]/.test(v), "Password must contain an uppercase letter.")
  .refine((v) => /\d/.test(v), "Password must contain a number.")
  .refine(
    (v) => /[^A-Za-z0-9]/.test(v),
    "Password must contain a special character."
  );

const BodySchema = z.object({
  token: z.string().min(10, "Invalid reset token."),
  password: passwordSchema,
});

// POST /api/auth/reset-password
export async function POST(req: Request) {
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
    // return the exact rule that failed (best for UI)
    const msg = parsed.error.issues?.[0]?.message ?? "Invalid input";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }

  const { token, password } = parsed.data;

  const db = await getDb();
  const users = db.collection("users");

  // check that token exists and is not expired
  const user = await users.findOne({
    resetPasswordToken: token,
    resetPasswordExpires: { $gt: new Date() },
  });

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Invalid or expired reset link" },
      { status: 400 }
    );
  }

  // hash new password
  const passwordHash = await hash(password, 12);

  // update password and clear reset token fields
  await users.updateOne(
    { _id: user._id },
    {
      $set: {
        passwordHash,
        updatedAt: new Date(),
      },
      $unset: {
        resetPasswordToken: "",
        resetPasswordExpires: "",
      },
    }
  );

  return NextResponse.json({ ok: true });
}
