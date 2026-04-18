// src/app/api/patients/[id]/route.ts
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import bcrypt from "bcryptjs";

/** Safe age from ISO dob (YYYY-MM-DD) */
function computeAge(dobIso?: string | null): number | null {
  if (!dobIso) return null;
  const dob = new Date(dobIso);
  if (Number.isNaN(dob.getTime())) return null;

  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age < 0 ? null : age;
}

// =======================
// GET (UNCHANGED)
// =======================
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid patient ID" }, { status: 400 });
    }

    const db = await getDb();

    const doc = await db.collection("users").findOne(
      { _id: new ObjectId(id), role: "patient" },
      {
        projection: {
          email: 1,
          name: 1,
          role: 1,
          profile: 1,
        },
      }
    );

    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const fullName =
      (doc as any)?.profile?.fullName ?? (doc as any)?.name ?? "";
    const dob = (doc as any)?.profile?.dob ?? null;
    const phone = (doc as any)?.profile?.phone ?? null;
    const address = (doc as any)?.profile?.address ?? null;
    const sex = (doc as any)?.profile?.sex ?? null;

    const age = computeAge(dob);

    return NextResponse.json({
      patient: {
        id,
        email: (doc as any)?.email ?? "",
        role: (doc as any)?.role ?? "patient",
        fullName,
        dob,
        age,
        phone,
        address,
        sex,
      },
    });
  } catch (e) {
    console.error("/api/patients/[id] GET error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// =======================
// PUT (EDIT PATIENT)
// =======================
export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid patient ID" }, { status: 400 });
    }

    const body = await req.json();
    const db = await getDb();
    const users = db.collection("users");

    const fullName = String(body.fullName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim();
    const dob = String(body.dob || "").trim();
    const address = String(body.address || "").trim();
    const sex = String(body.sex || "").trim();
    const password = String(body.password || "").trim();

    if (!fullName || !email) {
      return NextResponse.json(
        { error: "Full name and email are required." },
        { status: 400 }
      );
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email address." },
        { status: 400 }
      );
    }

    // Prevent duplicate emails
    const duplicate = await users.findOne({
      _id: { $ne: new ObjectId(id) },
      email,
    });

    if (duplicate) {
      return NextResponse.json(
        { error: "Another user already uses this email." },
        { status: 409 }
      );
    }

    const updateDoc: Record<string, any> = {
      email,
      name: fullName,
      full_name: fullName,
      "profile.fullName": fullName,
      "profile.phone": phone,
      "profile.dob": dob,
      "profile.address": address,
      "profile.sex": sex,
      updatedAt: new Date(),
    };

    // Optional password update
    if (password) {
      if (password.length < 8) {
        return NextResponse.json(
          { error: "Password must be at least 8 characters long." },
          { status: 400 }
        );
      }

      updateDoc.passwordHash = await bcrypt.hash(password, 12);
    }

    const result = await users.findOneAndUpdate(
      { _id: new ObjectId(id), role: "patient" },
      { $set: updateDoc },
      { returnDocument: "after" }
    );

    if (!result) {
      return NextResponse.json({ error: "Patient not found." }, { status: 404 });
    }

    const updated: any = result;
    const updatedDob = updated?.profile?.dob ?? null;

    return NextResponse.json({
      message: "Patient updated successfully.",
      patient: {
        id: updated._id.toHexString(),
        email: updated.email,
        role: updated.role,
        fullName: updated?.profile?.fullName ?? "",
        dob: updatedDob,
        age: computeAge(updatedDob),
        phone: updated?.profile?.phone ?? null,
        address: updated?.profile?.address ?? null,
        sex: updated?.profile?.sex ?? null,
      },
    });
  } catch (e) {
    console.error("/api/patients/[id] PUT error:", e);
    return NextResponse.json(
      { error: "Failed to update patient." },
      { status: 500 }
    );
  }
}

// =======================
// DELETE (REMOVE PATIENT)
// =======================
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid patient ID" }, { status: 400 });
    }

    const db = await getDb();
    const users = db.collection("users");

    const result = await users.deleteOne({
      _id: new ObjectId(id),
      role: "patient",
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Patient not found." }, { status: 404 });
    }

    return NextResponse.json({
      message: "Patient deleted successfully.",
    });
  } catch (e) {
    console.error("/api/patients/[id] DELETE error:", e);
    return NextResponse.json(
      { error: "Failed to delete patient." },
      { status: 500 }
    );
  }
}