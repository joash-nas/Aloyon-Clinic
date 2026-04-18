// src/app/api/me/summary/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

type AppointmentDoc = {
  _id: any;
  status?: string;
  // different shapes you already use elsewhere:
  day?: string;   // "YYYY-MM-DD"
  time?: string;  // "HH:MM"
  date?: Date;
  start?: Date;
  patientEmail?: string;
  patient_email?: string;
  patientId?: string;
  patientUserId?: any;
  userId?: any;
};

type OrderDoc = {
  _id: any;
  status?: string;
  total?: number;
  createdAt?: Date;
  patientEmail?: string;
  patient_email?: string;
  patientUserId?: any;
  userId?: any;
};

export const dynamic = "force-dynamic";

export async function GET(_req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const db = await getDb();
    const apptCol = db.collection<AppointmentDoc>("appointments");
    const ordersCol = db.collection<OrderDoc>("orders");

    const userId = session.user.id as string;
    const email = session.user.email as string;

    // ---- Build patient filter (tolerant to different schemas) -------------
    const patientIdCandidates: any[] = [];

    // Try ObjectId(userId)
    try {
      patientIdCandidates.push(new ObjectId(userId));
    } catch {
      // ignore if not valid
    }
    // Also keep raw string
    patientIdCandidates.push(userId);

    const basePatientFilter: any = {
      $or: [
        { patientEmail: email },
        { patient_email: email },
        { patientUserId: { $in: patientIdCandidates } },
        { userId: { $in: patientIdCandidates } },
        { patientId: { $in: patientIdCandidates } },
      ],
    };

    const now = new Date();

    // ================= Appointments: last check-up + upcoming count =========
    const apptDocs = await apptCol.find(basePatientFilter).toArray();

    const apptsWithTime = apptDocs
      .map((a) => {
        const at = pickApptDate(a);
        return at ? { doc: a, at } : null;
      })
      .filter(Boolean) as { doc: AppointmentDoc; at: Date }[];

    const doneStatuses = new Set(["done", "completed"]);
    const activeStatuses = new Set(["booked", "confirmed", "checked-in"]);

    const doneAppts = apptsWithTime.filter((x) =>
      doneStatuses.has(normalizeStatus(x.doc.status))
    );

    const upcomingAppts = apptsWithTime.filter(
      (x) =>
        activeStatuses.has(normalizeStatus(x.doc.status)) &&
        x.at.getTime() >= now.getTime()
    );

    // Last completed visit (check-up)
    doneAppts.sort((a, b) => b.at.getTime() - a.at.getTime());
    const lastDone = doneAppts[0] ?? null;
    const lastCheckDate = lastDone ? lastDone.at : null;

    // Recommended next = last check-up + 6 months
    let nextCheckDate: Date | null = null;
    if (lastCheckDate) {
      nextCheckDate = new Date(lastCheckDate);
      nextCheckDate.setMonth(nextCheckDate.getMonth() + 6);
    }

    const upcomingAppointmentsCount = upcomingAppts.length;

    // ================= Orders: per-patient stats ============================
    const ordersFilter: any = {
      $or: [
        { patientEmail: email },
        { patient_email: email },
        { patientUserId: { $in: patientIdCandidates } },
        { userId: { $in: patientIdCandidates } },
      ],
    };

    const orderDocs = await ordersCol
      .find(ordersFilter)
      .sort({ createdAt: -1, _id: -1 })
      .toArray();

    const ordersCount = orderDocs.length;

    const pendingOrders = orderDocs.filter((o) => {
      const s = normalizeOrderStatus(o.status);
      // treat everything not completed/cancelled as "pending / in-progress"
      return s !== "completed" && s !== "cancelled";
    }).length;

    const lastOrderDoc = orderDocs[0] ?? null;
    const lastOrder = lastOrderDoc
      ? {
          createdAt: (lastOrderDoc.createdAt || new Date()).toISOString(),
          total: Number(lastOrderDoc.total ?? 0),
        }
      : null;

    // ================= Final JSON for PatientOverview =======================
    return NextResponse.json({
      ordersCount,
      pendingOrders,
      lastOrder,
      upcomingAppointmentsCount,
      lastCheckupDate: lastCheckDate ? lastCheckDate.toISOString() : null,
      nextCheckupDate: nextCheckDate ? nextCheckDate.toISOString() : null,
    });
  } catch (err) {
    console.error("[GET /api/me/summary] error:", err);
    return NextResponse.json(
      { error: "Failed to load summary" },
      { status: 500 }
    );
  }
}

/* ---- helpers ------------------------------------------------------------ */

function normalizeStatus(s?: string): string {
  const v = (s || "").toLowerCase();
  if (v === "booked") return "booked";
  if (v === "confirmed") return "confirmed";
  if (v === "checked-in") return "checked-in";
  if (v === "done" || v === "completed") return "done";
  if (v === "cancelled" || v === "canceled") return "cancelled";
  return v || "unknown";
}

function normalizeOrderStatus(s?: string): string {
  const v = (s || "").toLowerCase();
  if (v === "pending") return "pending";
  if (v === "preparing") return "preparing";
  if (v === "ready") return "ready";
  if (v === "completed") return "completed";
  if (v === "cancelled" || v === "canceled") return "cancelled";
  return v || "unknown";
}

function pickApptDate(a: AppointmentDoc): Date | null {
  // 1) direct Date fields
  if (a.start instanceof Date) return a.start;
  if (a.date instanceof Date) return a.date;

  // 2) day + time strings: "YYYY-MM-DD" + "HH:MM"
  if (a.day) {
    const t = a.time && /^\d{2}:\d{2}$/.test(a.time) ? a.time : "09:00";
    const iso = `${a.day}T${t}:00`;
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return d;
  }

  return null;
}
