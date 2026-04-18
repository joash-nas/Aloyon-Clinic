// src/app/api/verify-email/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    // Missing token → send back to login with message
    return NextResponse.redirect(new URL("/login?verified=missing", url));
  }

  const db = await getDb();
  const users = db.collection("users");

  // Look for a user with this token that hasn't expired yet
  const user = await users.findOne({
    emailVerificationToken: token,
    emailVerificationExpires: { $gt: new Date() },
  });

  if (!user) {
    // Invalid or expired token
    return NextResponse.redirect(new URL("/login?verified=invalid", url));
  }

  // Mark as verified + clear token
  await users.updateOne(
    { _id: user._id },
    {
      $set: {
        emailVerified: true,
        updatedAt: new Date(),
      },
      $unset: {
        emailVerificationToken: "",
        emailVerificationExpires: "",
      },
    }
  );

  // Success → back to login
  return NextResponse.redirect(new URL("/login?verified=1", url));
}
