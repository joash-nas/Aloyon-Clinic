/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/patients/[id]/doctor-notes/route.ts
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";

// For human-readable labels in the history log
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

// only doctors allowed
function ensureDoctor(session: any) {
  const role = session?.user?.role as string | undefined;
  if (!session?.user?.id || role !== "doctor") {
    return false;
  }
  return true;
}

// 
// GET doctor notes
//   - ONLY doctor can view
//   - returns `notes` and `lastUpdated`

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


// PUT doctor notes
//   - ONLY doctor can edit
//   - only updates `updatedAt` + history
//     when there are actual changes

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
    const body = await req.json().catch(() => ({}));

    const src = (body && typeof body === "object" && (body as any).notes) || {};

    const notes = {
      preScreening: src.preScreening || "",
      chiefComplaint: src.chiefComplaint || "",
      monoPd: src.monoPd || "",
      binPd: src.binPd || "",
      presentCorrectionVa: src.presentCorrectionVa || "",
      visualRequirement: src.visualRequirement || "",
      ocularHistory: src.ocularHistory || "",
      lensTypeAgeCondition: src.lensTypeAgeCondition || "",
      odVa: src.odVa || "",
      odVaComment: src.odVaComment || "",
      osVa: src.osVa || "",
      osVaComment: src.osVaComment || "",
      planManagement: src.planManagement || "",
      qualityCheck: src.qualityCheck || "",
    };

    const db = await getDb();
    const coll = db.collection("doctor_notes");

    const patientId = new ObjectId(id);
    const doctorId = new ObjectId(session!.user!.id as string);

    // fetch existing notes to see what changed
    const existing = await coll.findOne<{ notes?: Record<string, any>; createdAt?: Date }>({
      patientId,
    });
    const existingNotes = existing?.notes || {};

    // compute which fields actually changed 
    const changedFields: string[] = [];
    for (const key of Object.keys(notes)) {
      const prevVal = String((existingNotes as any)[key] ?? "");
      const newVal = String((notes as any)[key] ?? "");
      if (prevVal !== newVal) {
        changedFields.push(FIELD_LABELS[key] || key);
      }
    }

    
    if (changedFields.length === 0) {
      const lastUpdated = (existing as any)?.updatedAt as Date | undefined;
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

    // log into patient_history 
    const users = db.collection("users");

    const doctorDoc = await users.findOne<{
      name?: string;
      email: string;
      profile?: { fullName?: string };
    }>(
      { _id: doctorId },
      { projection: { name: 1, email: 1, profile: 1 } }
    );

    const patientDoc = await users.findOne<{
      name?: string;
      email: string;
      profile?: { fullName?: string };
    }>(
      { _id: patientId },
      { projection: { name: 1, email: 1, profile: 1 } }
    );

    const doctorName =
      doctorDoc?.profile?.fullName || doctorDoc?.name || doctorDoc?.email || "Doctor";
    const patientName =
      patientDoc?.profile?.fullName || patientDoc?.name || patientDoc?.email || "Patient";

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
