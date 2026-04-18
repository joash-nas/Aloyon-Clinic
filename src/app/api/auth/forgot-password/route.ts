// src/app/api/auth/forgot-password/route.ts
/* Purpose: Start password reset flow by sending a reset link to the user email. */

import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { getDb } from "@/lib/mongodb";
import { sendPasswordResetEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  email: z.string().email(),
});

function getRequestBaseUrl(req: Request) {
  // Works on Vercel / proxies
  const proto = req.headers.get("x-forwarded-proto") || "http";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");

  if (host) return `${proto}://${host}`;

  // Fallback (usually fine in dev)
  return new URL(req.url).origin;
}

// POST /api/auth/forgot-password
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
    return NextResponse.json(
      { ok: false, error: "Invalid email" },
      { status: 400 }
    );
  }

  const email = parsed.data.email.trim().toLowerCase();

  const db = await getDb();
  const users = db.collection("users");

  const user = await users.findOne({ email });

  // always respond ok to avoid exposing if the email exists
  if (!user) {
    return NextResponse.json({ ok: true });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await users.updateOne(
    { _id: user._id },
    {
      $set: {
        resetPasswordToken: token,
        resetPasswordExpires: expires,
        updatedAt: new Date(),
      },
    }
  );

  // Pass base URL derived from request (prod will be real domain)
  const baseUrl = getRequestBaseUrl(req);

  try {
    await sendPasswordResetEmail(email, token, baseUrl);
  } catch (e) {
    console.error("[forgot-password] Failed to send reset email:", e);
  }

  return NextResponse.json({ ok: true });
}