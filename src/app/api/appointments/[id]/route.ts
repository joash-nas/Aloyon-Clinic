/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/appointments/[id]/route.ts

import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { z } from "zod";
import { awardPoints, POINTS_RULES } from "@/lib/rewards";

function isValidObjectId(s: string) {
  return /^[a-f\d]{24}$/i.test(s);
}

const PatchSchema = z.object({
  action: z.enum(["done", "cancel"]).optional(),
  status: z.enum(["booked", "done", "cancelled"]).optional(),
  notes: z.string().max(1000).optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const sessionUserId = String(session.user.id);
    const role = (session.user as any).role as string | undefined;

    const { id: rawId } = await ctx.params;
    if (!rawId || !isValidObjectId(rawId)) {
      return NextResponse.json(
        { ok: false, error: "Invalid id" },
        { status: 400 }
      );
    }

    const db = await getDb();
    const _id = new ObjectId(rawId);
    const col = db.collection("appointments");

    const appt = await col.findOne(
      { _id },
      { projection: { _id: 1, userId: 1, doctorId: 1, status: 1, notes: 1 } }
    );

    if (!appt) {
      return NextResponse.json(
        { ok: false, error: "Not found" },
        { status: 404 }
      );
    }

    const isPatient = String(appt.userId) === sessionUserId;
    const isStaff = !!role && ["doctor", "assistant", "admin"].includes(role);

    if (!isPatient && !isStaff) {
      return NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const prevStatus = String(appt.status || "");

    // Parse JSON body safely
    let rawBody: any = {};
    try {
      rawBody = await req.json();
    } catch {
      rawBody = {};
    }

    const parsed = PatchSchema.safeParse(rawBody || {});

    // If body is not empty AND schema fails → 400 with message
    if (!parsed.success && rawBody && Object.keys(rawBody).length > 0) {
      return NextResponse.json(
        { ok: false, error: "Invalid request body" },
        { status: 400 }
      );
    }

    // Decide next status
    let nextStatus: "done" | "cancelled" | null = null;
    let wantsDone = false;

    if (parsed.success) {
      const { action, status } = parsed.data;

      if (!isStaff) {
        // Patient can only cancel
        nextStatus = "cancelled";
        wantsDone = false;
      } else {
        if (action === "done" || status === "done") {
          nextStatus = "done";
          wantsDone = true;
        } else if (action === "cancel" || status === "cancelled") {
          nextStatus = "cancelled";
          wantsDone = false;
        } else {
          nextStatus = null; // no-op
        }
      }
    } else {
      // No body -> patient PATCH defaults to cancel; staff no-op
      nextStatus = isStaff ? null : "cancelled";
      wantsDone = false;
    }

    const update: any = {};

    // notes update
    if (parsed.success && typeof parsed.data.notes === "string") {
      update.notes = parsed.data.notes;
    }

    // status update
    if (nextStatus && String(appt.status) !== nextStatus) {
      update.status = nextStatus;
      if (nextStatus === "done") {
        update.doneAt = new Date();
        update.cancelledAt = null;
      } else {
        update.cancelledAt = new Date();
        update.doneAt = null;
      }
    }

    async function maybeAutoAward(patientIdAny: any) {
      const patientIdStr = String(patientIdAny || "");
      if (!isValidObjectId(patientIdStr)) return;

      await awardPoints({
        patientId: patientIdStr,
        staffId: sessionUserId,
        activity: "appointment",
        points: POINTS_RULES.appointmentDone,
        sourceType: "appointment",
        sourceId: _id.toHexString(),
        note: `Auto-award: appointment marked done (+${POINTS_RULES.appointmentDone})`,
      });
    }

    // If staff clicks done, attempt award even if already done (awardPoints dedups)
    if (isStaff && wantsDone) {
      try {
        await maybeAutoAward(appt.userId);
      } catch (e) {
        console.error("Auto-award (pre-update) failed:", e);
      }
    }

    // No changes needed -> success
    if (Object.keys(update).length === 0) {
      return NextResponse.json({
        ok: true,
        status: appt.status,
        appointment: appt,
      });
    }

    const upd = await col.updateOne({ _id }, { $set: update });

    if (!upd.matchedCount) {
      return NextResponse.json(
        { ok: false, error: "Appointment not found" },
        { status: 404 }
      );
    }

    // If we expected a change but nothing modified (e.g., same status), still okay
    const updated = await col.findOne({ _id });

    if (!updated) {
      return NextResponse.json(
        { ok: false, error: "Failed to read updated appointment" },
        { status: 500 }
      );
    }

    // Award on true transition to done
    if (isStaff && update.status === "done" && prevStatus !== "done") {
      try {
        await maybeAutoAward((updated as any).userId);
      } catch (e) {
        console.error("Auto-award (post-update) failed:", e);
      }
    }

    return NextResponse.json({
      ok: true,
      status: (updated as any).status,
      appointment: updated,
    });
  } catch (e) {
    console.error("PATCH /api/appointments/[id] error", e);
    return NextResponse.json(
      { ok: false, error: "Server error" },
      { status: 500 }
    );
  }
}