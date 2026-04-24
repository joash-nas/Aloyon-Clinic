/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";

function ensureDoctor(session: any) {
  const role = session?.user?.role as string | undefined;
  return Boolean(session?.user?.id && role === "doctor");
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
    const patientId = new ObjectId(id);

    const docs = await db
      .collection("patient_history")
      .find(
        {
          patientId,
          type: "doctor-notes",
        },
        {
          projection: {
            title: 1,
            description: 1,
            doctorName: 1,
            patientName: 1,
            changedFields: 1,
            notesSnapshot: 1,
            previousNotesSnapshot: 1,
            createdAt: 1,
          },
        }
      )
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    const items = docs.map((doc: any) => ({
      id: String(doc._id),
      title: doc.title || "Updated doctor notes",
      description: doc.description || "",
      doctorName: doc.doctorName || "Doctor",
      patientName: doc.patientName || "Patient",
      changedFields: Array.isArray(doc.changedFields) ? doc.changedFields : [],
      notesSnapshot: doc.notesSnapshot || null,
      previousNotesSnapshot: doc.previousNotesSnapshot || null,
      createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : null,
    }));

    return NextResponse.json({
      ok: true,
      items,
    });
  } catch (e) {
    console.error("doctor-notes history GET error:", e);
    return NextResponse.json(
      { ok: false, error: "Server error" },
      { status: 500 }
    );
  }
}