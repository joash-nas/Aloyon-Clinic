/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/auth/login-start/route.ts


import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { compare, hash } from "bcrypt";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { sendMail } from "@/lib/email";
import type { Role } from "@/lib/roles";

const BodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

// Roles that require 2FA
const TWOFA_ROLES: Role[] = ["admin", "doctor", "assistant", "sales", "supplier"];
const TWOFA_ROLE_SET = new Set<Role>(TWOFA_ROLES);

const EMAIL_TOKEN_SECRET = process.env.EMAIL_TOKEN_SECRET;

if (!EMAIL_TOKEN_SECRET) {
  console.warn(
    "[login-start] EMAIL_TOKEN_SECRET is not set. 2FA tokens will not work."
  );
}

export async function POST(req: NextRequest) {
  let parsed;
  try {
    const body = await req.json();
    parsed = BodySchema.safeParse(body);
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid email or password." },
      { status: 400 }
    );
  }

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid email or password." },
      { status: 400 }
    );
  }

  const { email, password } = parsed.data;

  const db = await getDb();
  const users = db.collection("users");

  const user: any = await users.findOne({ email });

  // error if no user, no passwordHash, wrong password, not verified
  if (!user?.passwordHash) {
    return NextResponse.json(
      { ok: false, error: "Invalid email or password." },
      { status: 400 }
    );
  }

  const ok = await compare(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json(
      { ok: false, error: "Invalid email or password." },
      { status: 400 }
    );
  }

  // Require email verification before login
  if (!user.emailVerified) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Invalid email or password.", // kept generic for security
      },
      { status: 400 }
    );
  }

  const role: Role = (user.role ?? "patient") as Role;
  const requires2fa = TWOFA_ROLE_SET.has(role);

  // If role does NOT need 2FA → allow direct NextAuth sign-in
  if (!requires2fa) {
    return NextResponse.json({ ok: true, mode: "direct" });
  }

  // If role needs 2FA → generate 6-digit code and send email
  if (!EMAIL_TOKEN_SECRET) {
    return NextResponse.json(
      { ok: false, error: "2FA is not configured on the server." },
      { status: 500 }
    );
  }

  const code = String(Math.floor(100000 + Math.random() * 900000)); // 100000–999999
  const codeHash = await hash(code, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  await users.updateOne(
    { _id: user._id },
    {
      $set: {
        twoFactorCodeHash: codeHash,
        twoFactorCodeExpiresAt: expiresAt,
      },
    }
  );

  const token = jwt.sign(
    {
      uid: user._id.toString(),
      kind: "2fa",
    },
    EMAIL_TOKEN_SECRET,
    { expiresIn: "10m" }
  );

  const appName = "Aloyon Optical";
  const html = `
    <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif; font-size: 14px;">
      <p>Hi,</p>
      <p>Here is your ${appName} 2-step sign-in code:</p>
      <p style="font-size: 24px; font-weight: 600; letter-spacing: 4px; margin: 16px 0;">
        ${code}
      </p>
      <p>This code will expire in 10 minutes.</p>
      <p>If you did not try to sign in, you can ignore this email.</p>
    </div>
  `;

  try {
    await sendMail({
      to: email,
      subject: `${appName} sign-in code`,
      html,
    });
  } catch (e) {
    console.error("[login-start] Failed to send 2FA email:", e);
    return NextResponse.json(
      { ok: false, error: "Could not send verification code. Try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    mode: "2fa",
    token,
  });
}
