/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/admin/users/route.ts
// Admin-only endpoints for listing users, creating users, and updating their roles.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { z } from "zod";
import type { Role } from "@/lib/roles";
import { hash } from "bcrypt";
import { sendMail } from "@/lib/email";

// Normalize MongoDB user document into a simple row for the UI.
function toRow(doc: any) {
  return {
    id: doc._id.toString(),
    email: doc.email as string,
    full_name: (doc.full_name ?? doc.name ?? null) as string | null,
    role: doc.role as Role,
    created_at: (
      doc.createdAt instanceof Date
        ? doc.createdAt.toISOString()
        : (doc.created_at ?? doc.createdAt ?? new Date()).toString()
    ) as string,
  };
}

// Returns a typed, non-null admin session or a Response you can return.
function requireAdmin(session: Session | null): { session?: Session; denied?: Response } {
  if (!session?.user) {
    return { denied: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }
  if ((session.user as any).role !== "admin") {
    return { denied: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

function genTempPassword(length = 12) {
  // readable-ish temp password: letters + numbers, avoid confusing chars
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

// GET /api/admin/users
export async function GET() {
  const raw = await getServerSession(authOptions);
  const { session, denied } = requireAdmin(raw);
  if (denied) return denied;

  const db = await getDb();
  const users = db.collection("users");

  const docs = await users
    .find(
      {},
      { projection: { email: 1, full_name: 1, name: 1, role: 1, createdAt: 1 } }
    )
    .sort({ createdAt: -1 })
    .toArray();

  return NextResponse.json(docs.map(toRow));
}

// ------------------ CREATE USER (ADMIN) -----------------------------------

const CreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email(),
  role: z.enum(["admin", "doctor", "assistant", "sales", "supplier"] as const),
});

// POST /api/admin/users
// Creates a non-patient account (staff/supplier) and emails credentials.

export async function POST(req: Request) {
  const raw = await getServerSession(authOptions);
  const { session, denied } = requireAdmin(raw);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { name, email, role } = parsed.data;

  const db = await getDb();
  const users = db.collection("users");

  const exists = await users.findOne({ email });
  if (exists) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  const tempPassword = genTempPassword(12);
  const passwordHash = await hash(tempPassword, 12);

  const now = new Date();

  // Create user doc (keep fields consistent with your existing register flow)
  const insertRes = await users.insertOne({
    email,
    name,
    full_name: name,
    role: role as Role,
    passwordHash,
    profile: {
      fullName: name,
      dob: null,
      phone: null,
      address: null,
      sex: null,
    },
    // Staff accounts are provisioned by admin, mark as verified to avoid extra friction
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });

  // Audit log
  await db.collection("audit_logs").insertOne({
    type: "admin_create_user",
    user: (session!.user as any).email,
    actorId: new ObjectId((session!.user as any).id),
    targetUserId: insertRes.insertedId,
    targetEmail: email,
    role,
    action: `Created user account: ${email} (role: ${role})`,
    timestamp: now,
  });

  // Email credentials
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    new URL(req.url).origin ||
    "http://localhost:3000";

  const loginUrl = `${baseUrl}/login`;
  const forgotUrl = `${baseUrl}/forgot-password`;

  try {
    await sendMail({
      to: email,
      subject: "Your Aloyon Optical staff account credentials",
      html: `
        <p>Hi ${name},</p>
        <p>An admin created your <strong>Aloyon Optical</strong> account.</p>

        <p><strong>Login:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
        <p><strong>Email:</strong> ${email}<br/>
           <strong>Temporary Password:</strong> ${tempPassword}</p>

        <p style="margin-top:14px;">
          For security, please change your password after signing in.
          If you want to set your own password immediately, you can use:
          <a href="${forgotUrl}">${forgotUrl}</a>
        </p>
      `,
    });
  } catch (e) {
    console.error("[admin/users POST] Failed to send credentials email:", e);
    // account is still created; admin can resend manually later
  }

  const created = await users.findOne({ _id: insertRes.insertedId });
  return NextResponse.json(toRow(created));
}

// ------------------ ROLE UPDATE -------------------------------------------

// Schema for role updates coming from the admin UI.
const PatchSchema = z.object({
  id: z.string().trim().min(1),
  role: z.enum(["admin", "doctor", "assistant", "sales", "patient", "supplier"] as const),
  reason: z.string().trim().min(5).max(200),
});

// PATCH /api/admin/users
// Updates the role of a specific user and records the change in audit_logs.
export async function PATCH(req: Request) {
  const raw = await getServerSession(authOptions);
  const { session, denied } = requireAdmin(raw);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { id, role, reason } = parsed.data;

  // Prevent admins from removing their own admin role.
  if ((session!.user as any).id === id && role !== "admin") {
    return NextResponse.json(
      { error: "You cannot change your own role." },
      { status: 400 }
    );
  }

  const db = await getDb();
  const users = db.collection("users");
  const _id = new ObjectId(id);

  // Fetch current user document for audit logging.
  const targetUser = await users.findOne({ _id });
  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // If no actual change, reject 
  if ((targetUser.role as Role) === role) {
    return NextResponse.json(
      { error: "Role is already set to that value." },
      { status: 400 }
    );
  }

  // Apply role change.
  await users.updateOne({ _id }, { $set: { role } });

  // Record role change in audit_logs.
  const audit = db.collection("audit_logs");
  await audit.insertOne({
    type: "role_change",
    user: (session!.user as any).email,
    actorId: new ObjectId((session!.user as any).id),
    targetUserId: _id,
    targetEmail: targetUser.email,
    from: targetUser.role,
    to: role,
    reason,
    action: `Changed user role: ${targetUser.email} from ${targetUser.role} → ${role}`,
    timestamp: new Date(),
  });

  const updated = await users.findOne({ _id });
  return NextResponse.json(toRow(updated));
}
