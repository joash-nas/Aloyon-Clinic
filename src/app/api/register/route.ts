// src/app/api/register/route.ts

import { NextResponse } from "next/server";
import { z } from "zod";
import { hash } from "bcrypt";
import crypto from "crypto";
import { getDb } from "@/lib/mongodb";
import type { Role } from "@/lib/roles";
import { sendMail } from "@/lib/email";

export const runtime = "nodejs"; // needed for nodemailer on Vercel
export const dynamic = "force-dynamic";

const SexEnum = z.enum(["male", "female", "other", "prefer_not_to_say"]);

// Strong password rules (server-side)
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

// Require ALL fields in profile, including first/last
const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required."),
  lastName: z.string().min(1, "Last name is required."),
  dob: z.string().min(1, "Date of birth is required."),
  phone: z.string().min(1, "Phone is required."),
  address: z.string().min(1, "Address is required."),
  sex: SexEnum,
});

const schema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: passwordSchema,
  profile: profileSchema,
});

function prettyField(path: PropertyKey[]) {
  const key = path
    .map((p) => (typeof p === "symbol" ? p.toString() : String(p)))
    .join(".");

  const map: Record<string, string> = {
    email: "Email",
    password: "Password",
    "profile.firstName": "First name",
    "profile.lastName": "Last name",
    "profile.dob": "Date of birth",
    "profile.sex": "Sex",
    "profile.phone": "Phone",
    "profile.address": "Address",
  };

  return map[key] || key || "Field";
}

export async function POST(req: Request) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request. Please try again." },
      { status: 400 }
    );
  }

  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    // friendly required-fields message
    const required = new Set<string>();
    for (const issue of parsed.error.issues) {
      if (issue.code === "invalid_type") required.add(prettyField(issue.path));
      if (issue.code === "too_small") required.add(prettyField(issue.path));
    }

    if (required.size > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `Please fill in all required fields: ${Array.from(required).join(
            ", "
          )}.`,
        },
        { status: 400 }
      );
    }

    const msg = parsed.error.issues?.[0]?.message ?? "Invalid input";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }

  const db = await getDb();
  const users = db.collection("users");

  const email = parsed.data.email.trim().toLowerCase();
  const password = parsed.data.password;

  const p = parsed.data.profile;
  const firstName = p.firstName.trim();
  const lastName = p.lastName.trim();
  const fullName = `${firstName} ${lastName}`.trim().replace(/\s+/g, " ");

  const exists = await users.findOne({ email });
  if (exists) {
    return NextResponse.json(
      { ok: false, error: "Email already in use" },
      { status: 409 }
    );
  }

  const passwordHash = await hash(password, 12);

  // IMPORTANT: store only the profile fields your Mongo validator likely expects
  
  const cleanProfile = {
    fullName,
    dob: p.dob.trim(),
    phone: p.phone.trim(),
    address: p.address.trim(),
    sex: p.sex,
  };

  // --- email verification token + expiry (24 hours) ---
  const verificationToken = crypto.randomBytes(32).toString("hex");
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const docToInsert = {
    email,
    name: fullName,          // common field
    full_name: fullName,     // some validators require this (seen in your docs)
    role: "patient" as Role, // force patient
    passwordHash,
    profile: cleanProfile,
    emailVerified: false,
    emailVerificationToken: verificationToken,
    emailVerificationExpires: verificationExpires,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  try {
    await users.insertOne(docToInsert);
  } catch (e: any) {
    // Helpful dev log: Mongo schema validator details
    console.error("[register] insertOne failed:", e?.code, e?.message);
    if (e?.errInfo) console.error("[register] errInfo:", e.errInfo);

    return NextResponse.json(
      {
        ok: false,
        error:
          "Registration failed due to database validation rules. Please contact the admin or update the users collection validator.",
      },
      { status: 400 }
    );
  }

  // --- send verification email ---
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    new URL(req.url).origin ||
    "http://localhost:3000";

  const verifyUrl = `${baseUrl}/api/verify-email?token=${verificationToken}`;

  try {
    await sendMail({
      to: email,
      subject: "Verify your Aloyon Optical account",
      html: `
        <p>Hi ${fullName},</p>
        <p>Thank you for creating an account with <strong>Aloyon Optical</strong>.</p>
        <p>Please confirm your email address by clicking the button below:</p>
        <p>
          <a href="${verifyUrl}"
             style="display:inline-block;padding:10px 16px;border-radius:6px;background:#111;color:#fff;text-decoration:none;">
            Verify my email
          </a>
        </p>
        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <p><a href="${verifyUrl}">${verifyUrl}</a></p>
        <p>This link will expire in 24 hours.</p>
      `,
    });
  } catch (e) {
    console.error("[register] Failed to send verification email:", e);
  }

  return NextResponse.json({ ok: true });
}