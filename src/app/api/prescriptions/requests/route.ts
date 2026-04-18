/* =============================================================================
   File: src/app/api/prescriptions/requests/route.ts
   Purpose:
     - POST: Patients create a prescription request.
     - GET :
         • Patients -> list own requests
         • Staff    -> list all / filter by patient / status
   Roles:
     - Patient: can only see + create their own.
     - Staff (doctor, assistant, admin): can see all.
   ============================================================================ */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ObjectId } from "mongodb";
import { z } from "zod";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";

const StaffRoles = new Set(["doctor", "assistant", "admin"]);

const CreateSchema = z.object({
  message: z.string().max(1000).optional(),
});

const ListQuery = z.object({
  scope: z.enum(["self", "all", "by-patient"]).optional().default("self"),
  status: z.enum(["pending", "sent", "rejected"]).optional(),
  patientId: z.string().length(24).optional(),
});

/** Map Mongo doc to JSON-safe object */
function mapDoc(d: any) {
  return {
    id: String(d._id),
    patientId: d.patientId ? String(d.patientId) : null,
    patientEmail: d.patientEmail ?? null,
    patientName: d.patientName ?? null,
    message: d.message ?? null,
    status: d.status ?? "pending",
    createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt,
    updatedAt: d.updatedAt instanceof Date ? d.updatedAt.toISOString() : d.updatedAt,
    resolvedAt:
      d.resolvedAt instanceof Date ? d.resolvedAt.toISOString() : d.resolvedAt ?? null,
    resolutionNote: d.resolutionNote ?? null,
  };
}


// POST /api/prescriptions/requests  (patient creates request)

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as any).role as string | undefined;
  if (role !== "patient") {
    // Only patients can create requests
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  let parsed;
  try {
    const body = await req.json();
    parsed = CreateSchema.safeParse(body);
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid payload" },
      { status: 400 }
    );
  }
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid input" },
      { status: 400 }
    );
  }

  const db = await getDb();
  const users = db.collection("users");
  const coll = db.collection("prescription_requests");

  const patientId = new ObjectId(session.user.id);

  // patient basic info (email/name)
  const patient = await users.findOne(
    { _id: patientId },
    { projection: { email: 1, name: 1, role: 1 } }
  );
  if (!patient || patient.role !== "patient") {
    return NextResponse.json(
      { ok: false, error: "Patient not found" },
      { status: 404 }
    );
  }

  // Prevent multiple simultaneous pending requests
  const existingPending = await coll.findOne({
    patientId,
    status: "pending",
  });
  if (existingPending) {
    return NextResponse.json(
      { ok: false, error: "You already have a pending prescription request." },
      { status: 400 }
    );
  }

  const now = new Date();
  const doc = {
    patientId,
    patientEmail: patient.email ?? null,
    patientName: patient.name ?? null,
    message: parsed.data.message?.trim() || null,
    status: "pending" as const,
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
    resolvedBy: null,
    resolutionNote: null,
  };

  const r = await coll.insertOne(doc);
  const inserted = await coll.findOne({ _id: r.insertedId });

  return NextResponse.json(
    { ok: true, request: inserted ? mapDoc(inserted) : null },
    { status: 201 }
  );
}

// GET /api/prescriptions/requests

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as any).role as string | undefined;
  const url = new URL(req.url);
  const parsed = ListQuery.safeParse({
    scope: url.searchParams.get("scope") || undefined,
    status: url.searchParams.get("status") || undefined,
    patientId: url.searchParams.get("patientId") || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid query" },
      { status: 400 }
    );
  }

  const { scope, status, patientId } = parsed.data;
  const db = await getDb();
  const coll = db.collection("prescription_requests");

  const match: any = {};

  if (role === "patient") {
    // Patients can only see their own requests, ignore other scopes
    match.patientId = new ObjectId(session.user.id);
    if (status) match.status = status;
  } else if (StaffRoles.has(role || "")) {
    // Staff view
    if (scope === "by-patient" && patientId) {
      match.patientId = new ObjectId(patientId);
    }
    if (status) match.status = status;
  } else {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const docs = await coll
    .find(match)
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();

  return NextResponse.json({
    ok: true,
    items: docs.map(mapDoc),
  });
}
