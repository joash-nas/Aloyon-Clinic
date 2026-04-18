/* =============================================================================
   File: src/app/api/prescriptions/requests/[id]/route.ts
   Purpose:
     Staff endpoint to update prescription request status:
       - action=mark_sent
       - action=reject
   ============================================================================ */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ObjectId } from "mongodb";
import { z } from "zod";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";

const StaffRoles = new Set(["doctor"]);

const BodySchema = z.object({
  action: z.enum(["mark_sent", "reject"]),
  note: z.string().max(1000).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as any).role as string | undefined;
  if (!StaffRoles.has(role || "")) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = params;
  if (!id || id.length !== 24) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  let parsed;
  try {
    const body = await req.json();
    parsed = BodySchema.safeParse(body);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });
  }

  const { action, note } = parsed.data;

  const db = await getDb();
  const coll = db.collection("prescription_requests");

  const now = new Date();
  const staffId = new ObjectId(session.user.id);

  let update: any;
  if (action === "mark_sent") {
    update = {
      $set: {
        status: "sent",
        updatedAt: now,
        resolvedAt: now,
        resolvedBy: staffId,
        resolutionNote: note?.trim() || null,
      },
    };
  } else {
    // reject
    update = {
      $set: {
        status: "rejected",
        updatedAt: now,
        resolvedAt: now,
        resolvedBy: staffId,
        resolutionNote: note?.trim() || null,
      },
    };
  }

  const r = await coll.updateOne({ _id: new ObjectId(id) }, update);
  if (!r.matchedCount) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const updated = await coll.findOne({ _id: new ObjectId(id) });

  return NextResponse.json({ ok: true, request: updated }, { status: 200 });
}
