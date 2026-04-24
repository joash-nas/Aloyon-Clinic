// src/app/api/patients/[id]/doctor-notes/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";

const FIELD_LABELS: Record<string, string> = {
  preScreening: "Pre-screening",
  chiefComplaint: "Chief complaint",
  monoPd: "Mono PD",
  binPd: "Binocular PD",
  presentCorrectionVa: "Present correction VA",
  visualRequirement: "Visual requirement",
  ocularHistory: "Ocular history",
  lensTypeAgeCondition: "Lens type / age / condition",
  odVa: "OD VA",
  odVaComment: "OD VA comment",
  osVa: "OS VA",
  osVaComment: "OS VA comment",
  planManagement: "Plan / management",
  qualityCheck: "Quality check",
};

function ensureDoctor(session: any) {
  const role = session?.user?.role as string | undefined;
  return Boolean(session?.user?.id && role === "doctor");
}

function sanitizeNotes(src: any) {
  return {
    preScreening: src?.preScreening || "",
    chiefComplaint: src?.chiefComplaint || "",
    monoPd: src?.monoPd || "",
    binPd: src?.binPd || "",
    presentCorrectionVa: src?.presentCorrectionVa || "",
    visualRequirement: src?.visualRequirement || "",
    ocularHistory: src?.ocularHistory || "",
    lensTypeAgeCondition: src?.lensTypeAgeCondition || "",
    odVa: src?.odVa || "",
    odVaComment: src?.odVaComment || "",
    osVa: src?.osVa || "",
    osVaComment: src?.osVaComment || "",
    planManagement: src?.planManagement || "",
    qualityCheck: src?.qualityCheck || "",
  };
}

function displayName(doc: any, fallback: string) {
  return doc?.profile?.fullName || doc?.name || doc?.email || fallback;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!ensureDoctor(session)) {
      return NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const { id } = await ctx.params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { ok: false, error: "Invalid patient ID" },
        { status: 400 }
      );
    }

    const db = await getDb();

    const doc = await db.collection("doctor_notes").findOne(
      { patientId: new ObjectId(id) },
      { projection: { _id: 0 } }
    );

    const updatedAt = (doc as any)?.updatedAt as Date | undefined;

    return NextResponse.json({
      ok: true,
      notes: doc?.notes ?? null,
      lastUpdated: updatedAt ? updatedAt.toISOString() : null,
    });
  } catch (e) {
    console.error("doctor-notes GET error:", e);
    return NextResponse.json(
      { ok: false, error: "Server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!ensureDoctor(session)) {
      return NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const { id } = await ctx.params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { ok: false, error: "Invalid patient ID" },
        { status: 400 }
      );
    }

    if (!ObjectId.isValid(session!.user!.id as string)) {
      return NextResponse.json(
        { ok: false, error: "Invalid doctor ID" },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const src = body?.notes || {};
    const notes = sanitizeNotes(src);

    const db = await getDb();
    const coll = db.collection("doctor_notes");

    const patientId = new ObjectId(id);
    const doctorId = new ObjectId(session!.user!.id as string);

    const existing = await coll.findOne<{
      notes?: Record<string, any>;
      createdAt?: Date;
      updatedAt?: Date;
    }>({ patientId });

    const existingNotes = existing?.notes || {};

    const changedFields: string[] = [];

    for (const key of Object.keys(notes)) {
      const prevVal = String((existingNotes as any)[key] ?? "");
      const newVal = String((notes as any)[key] ?? "");

      if (prevVal !== newVal) {
        changedFields.push(FIELD_LABELS[key] || key);
      }
    }

    if (changedFields.length === 0) {
      const lastUpdated = existing?.updatedAt;

      return NextResponse.json({
        ok: true,
        changed: false,
        updatedAt: lastUpdated ? lastUpdated.toISOString() : null,
      });
    }

    const now = new Date();

    if (existing) {
      await coll.updateOne(
        { patientId },
        {
          $set: {
            notes,
            updatedAt: now,
            doctorId,
          },
        }
      );
    } else {
      await coll.insertOne({
        patientId,
        doctorId,
        notes,
        createdAt: now,
        updatedAt: now,
      });
    }

    const users = db.collection("users");

    const doctorDoc = await users.findOne(
      { _id: doctorId },
      { projection: { name: 1, email: 1, profile: 1 } }
    );

    const patientDoc = await users.findOne(
      { _id: patientId },
      { projection: { name: 1, email: 1, profile: 1 } }
    );

    const doctorName = displayName(doctorDoc, "Doctor");
    const patientName = displayName(patientDoc, "Patient");

    const title = `Updated doctor notes for ${patientName}`;

    const description =
      changedFields.length === 1
        ? `Changed field: ${changedFields[0]}.`
        : `Changed fields: ${changedFields.join(", ")}.`;

    await db.collection("patient_history").insertOne({
      patientId,
      doctorId,
      doctorName,
      patientName,
      type: "doctor-notes",
      title,
      description,
      changedFields,

      // important for viewing complete past notes
      notesSnapshot: notes,
      previousNotesSnapshot: existingNotes,

      createdAt: now,
    });

    return NextResponse.json({
      ok: true,
      changed: true,
      updatedAt: now.toISOString(),
    });
  } catch (e) {
    console.error("doctor-notes PUT error:", e);
    return NextResponse.json(
      { ok: false, error: "Server error" },
      { status: 500 }
    );
  }
}