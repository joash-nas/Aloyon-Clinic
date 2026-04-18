/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ObjectId } from "mongodb";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { getRewardsSummary } from "@/lib/rewards";

const STAFF_ROLES = new Set(["assistant", "staff", "admin", "doctor"]);

function parseQrInput(input: string) {
  const raw = String(input || "").trim();

  // new token-based QR
  if (/^ALOYON:PT:[a-f\d]{32}$/i.test(raw)) {
    return {
      kind: "token" as const,
      token: raw.replace(/^ALOYON:PT:/i, ""),
    };
  }

  // legacy raw userId QR
  if (/^ALYON_PATIENT:[a-f\d]{24}$/i.test(raw)) {
    return {
      kind: "patientId" as const,
      patientId: raw.replace(/^ALYON_PATIENT:/i, ""),
    };
  }

  // backup: raw token only
  if (/^[a-f\d]{32}$/i.test(raw)) {
    return {
      kind: "token" as const,
      token: raw,
    };
  }

  // backup: raw patientId only
  if (/^[a-f\d]{24}$/i.test(raw)) {
    return {
      kind: "patientId" as const,
      patientId: raw,
    };
  }

  return {
    kind: "invalid" as const,
  };
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const role = String((session.user as any).role || "");
    if (!STAFF_ROLES.has(role)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const qr = String(body?.qr || "").trim();

    const parsed = parseQrInput(qr);
    if (parsed.kind === "invalid") {
      return NextResponse.json(
        { ok: false, error: "Invalid QR or manual input." },
        { status: 400 }
      );
    }

    const db = await getDb();
    const users = db.collection("users");

    let patient: any = null;

    if (parsed.kind === "patientId") {
      patient = await users.findOne(
        { _id: new ObjectId(parsed.patientId) },
        {
          projection: {
            email: 1,
            name: 1,
            role: 1,
            qrToken: 1,
            "profile.fullName": 1,
          },
        }
      );
    }

    if (parsed.kind === "token") {
      patient = await users.findOne(
        { qrToken: parsed.token },
        {
          projection: {
            email: 1,
            name: 1,
            role: 1,
            qrToken: 1,
            "profile.fullName": 1,
          },
        }
      );
    }

    if (!patient) {
      return NextResponse.json(
        { ok: false, error: "Patient not found." },
        { status: 404 }
      );
    }

    if (String((patient as any).role || "") !== "patient") {
      return NextResponse.json(
        { ok: false, error: "QR does not belong to a patient." },
        { status: 400 }
      );
    }

    const patientId = String((patient as any)._id);
    const summary = await getRewardsSummary(patientId);

    return NextResponse.json({
      ok: true,
      patient: {
        id: patientId,
        name:
          (patient as any)?.profile?.fullName ||
          (patient as any)?.name ||
          (patient as any)?.email ||
          "Patient",
        email: (patient as any)?.email || null,
      },
      rewards: summary,
    });
  } catch (e) {
    console.error("POST /api/staff/rewards/resolve-qr error:", e);
    return NextResponse.json(
      { ok: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}