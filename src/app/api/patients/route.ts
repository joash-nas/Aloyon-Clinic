// src/app/api/patients/route.ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { hash } from "bcrypt";
import type { Role } from "@/lib/roles";

/** Safe age from ISO dob (YYYY-MM-DD) */
function computeAge(dobIso?: string | null): number | null {
  if (!dobIso) return null;

  const dob = new Date(dobIso);
  if (Number.isNaN(dob.getTime())) return null;

  const now = new Date();

  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();

  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) {
    age -= 1;
  }

  return age < 0 ? null : age;
}

function normalizeDob(input: string): string {
  const value = (input || "").trim();

  if (!value) return "";

  // HTML date input format
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  // Allows DD/MM/YYYY
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (m) {
    const [, dd, mm, yyyy] = m;
    return `${yyyy}-${mm}-${dd}`;
  }

  return value;
}

function normalizeSex(value: string) {
  if (
    value === "male" ||
    value === "female" ||
    value === "other" ||
    value === "prefer_not_to_say"
  ) {
    return value;
  }

  return "prefer_not_to_say";
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const q = (searchParams.get("q") || "").trim();

    const limit = Math.max(
      1,
      Math.min(200, Number(searchParams.get("limit") || 100))
    );

    const skip = Math.max(0, Number(searchParams.get("skip") || 0));

    const db = await getDb();
    const users = db.collection("users");

    const filter: any = { role: "patient" };

    if (q) {
      filter.$or = [
        { "profile.fullName": { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
        { "profile.phone": { $regex: q, $options: "i" } },
      ];
    }

    const cursor = users
      .find(filter, {
        projection: {
          email: 1,
          role: 1,
          profile: {
            fullName: 1,
            phone: 1,
            dob: 1,
            address: 1,
            sex: 1,
          },
        },
      })
      .skip(skip)
      .limit(limit)
      .sort({ "profile.fullName": 1, email: 1 });

    const items = await cursor.toArray();

    const ids: ObjectId[] = items
      .map((it: any) => it._id)
      .filter((id: any) => id instanceof ObjectId);

    let lastVisitMap = new Map<string, Date>();

    if (ids.length > 0) {
      const agg = await db
        .collection("appointments")
        .aggregate<{ _id: ObjectId; lastVisit: Date }>([
          {
            $match: {
              userId: { $in: ids },
              status: "done",
            },
          },
          {
            $group: {
              _id: "$userId",
              lastVisit: {
                $max: {
                  $ifNull: ["$date", "$createdAt"],
                },
              },
            },
          },
        ])
        .toArray();

      lastVisitMap = new Map(
        agg.map((d) => [d._id.toHexString(), d.lastVisit])
      );
    }

    const itemsWithLastVisit = items.map((doc: any) => {
      const idStr = doc._id instanceof ObjectId ? doc._id.toHexString() : "";
      const lv = idStr ? lastVisitMap.get(idStr) : undefined;
      const dob = doc?.profile?.dob ?? null;

      return {
        ...doc,
        _id: idStr,
        email: doc.email || null,
        age: computeAge(dob),
        lastVisit: lv ? lv.toISOString() : null,
      };
    });

    return NextResponse.json({
      items: itemsWithLastVisit,
      count: itemsWithLastVisit.length,
    });
  } catch (err) {
    console.error("/api/patients GET error", err);

    return NextResponse.json(
      {
        items: [],
        error: "failed",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const db = await getDb();
    const users = db.collection("users");

    const body = await req.json();

    const fullName = String(body.fullName || "")
      .trim()
      .replace(/\s+/g, " ");

    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim();
    const address = String(body.address || "").trim();
    const password = String(body.password || "").trim();
    const sex = String(body.sex || "prefer_not_to_say").trim();

    const dob = normalizeDob(String(body.dob || "").trim());

    // Only full name is required.
    if (!fullName) {
      return NextResponse.json(
        { error: "Full name is required." },
        { status: 400 }
      );
    }

    // Validate email only if provided.
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailRegex.test(email)) {
        return NextResponse.json(
          { error: "Invalid email address." },
          { status: 400 }
        );
      }

      const existing = await users.findOne({ email });

      if (existing) {
        return NextResponse.json(
          { error: "A user with this email already exists." },
          { status: 409 }
        );
      }
    }

    // Validate DOB only if provided.
    if (dob && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      return NextResponse.json(
        { error: "Date of birth must be in YYYY-MM-DD format." },
        { status: 400 }
      );
    }

    // Validate password only if provided.
    if (password && password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long." },
        { status: 400 }
      );
    }

    const now = new Date();

    const newPatient: any = {
      name: fullName,
      full_name: fullName,
      role: "patient" as Role,

      profile: {
        fullName,
        dob: dob || null,
        phone: phone || null,
        address: address || null,
        sex: normalizeSex(sex),
      },

      // No login access unless email/password are added later.
      emailVerified: email ? now : null,
      emailVerificationToken: null,
      emailVerificationExpires: null,

      createdAt: now,
      updatedAt: now,
    };

    // Only save email if provided.
    // This prevents showing fake/placeholder emails.
    if (email) {
      newPatient.email = email;
    }

    // Only save passwordHash if provided.
    // Since your form removed password, this usually will not be added.
    if (password) {
      newPatient.passwordHash = await hash(password, 12);
    }

    const result = await users.insertOne(newPatient);

    return NextResponse.json(
      {
        message: "Patient added successfully.",
        item: {
          _id: result.insertedId.toHexString(),
          email: newPatient.email || null,
          role: newPatient.role,
          name: newPatient.name,
          full_name: newPatient.full_name,
          profile: newPatient.profile,
          age: computeAge(newPatient.profile.dob),
          lastVisit: null,
          emailVerified: newPatient.emailVerified,
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("/api/patients POST error", err);
    console.error(
      "validator details:",
      JSON.stringify(err?.errInfo || err?.errorResponse, null, 2)
    );

    return NextResponse.json(
      {
        error: err?.message || "Failed to add patient.",
      },
      { status: 500 }
    );
  }
}