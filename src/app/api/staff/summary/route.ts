// src/app/api/staff/summary/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const dynamic = "force-dynamic";

type AppointmentDoc = {
  _id: any;
  status?: string;
  date?: Date;
  start?: Date;
  reason?: string | null;
  patientName?: string;
  patient_name?: string;
  patient_full_name?: string;
};

type OrderDoc = {
  _id: any;
  status: string;
  total?: number;
  createdAt: Date;
  orderNumber?: string;
  patientName?: string | null;
};

type ProductDoc = {
  _id: any;
  name: string;
  slug: string;
  qty: number;
  status?: string;
};

type UserDoc = {
  _id: any;
  role?: string;
};

export async function GET(_req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const db = await getDb();
    const apptCol = db.collection<AppointmentDoc>("appointments");
    const ordersCol = db.collection<OrderDoc>("orders");
    const productsCol = db.collection<ProductDoc>("products");
    const usersCol = db.collection<UserDoc>("users");

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const year = now.getFullYear();
    const month = now.getMonth();
    const monthStart = new Date(year, month, 1, 0, 0, 0, 0);
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);

    // ---- Appointments: today ---------------------------------------------
    const todayRangeFilter: any = {
      $or: [
        { date: { $gte: todayStart, $lte: todayEnd } },
        { start: { $gte: todayStart, $lte: todayEnd } },
      ],
    };

    const baseApptFilter: any = { ...todayRangeFilter };

    const [
      todayAppointmentsTotal,
      pendingCount,
      confirmedCount,
      checkedInCount,
      doneCount,
      cancelledCount,
      upcomingDocs,
    ] = await Promise.all([
      apptCol.countDocuments(baseApptFilter),
      apptCol.countDocuments({ ...baseApptFilter, status: "booked" }),
      apptCol.countDocuments({ ...baseApptFilter, status: "confirmed" }),
      apptCol.countDocuments({ ...baseApptFilter, status: "checked-in" }),
      apptCol.countDocuments({
        ...baseApptFilter,
        status: { $in: ["done", "completed"] },
      }),
      apptCol.countDocuments({ ...baseApptFilter, status: "cancelled" }),
      apptCol
        .find({
          ...baseApptFilter,
          status: { $in: ["booked", "confirmed", "checked-in"] },
        })
        .sort({ start: 1, date: 1, _id: 1 })
        .limit(12)
        .toArray(),
    ]);

    const todayByStatus = {
      pending: pendingCount,
      confirmed: confirmedCount,
      checkedIn: checkedInCount,
      done: doneCount,
      cancelled: cancelledCount,
    };

    const mappedUpcoming = upcomingDocs
      .map((doc) => {
        const a: any = doc;
        const startDate = pickStart(a);
        if (!startDate) return null;
        return {
          id: String(a._id),
          time: startDate.toISOString(),
          patientName: pickPatientName(a),
          reason: (a.reason as string | null) ?? null,
          status: (a.status as string) || "pending",
        };
      })
      .filter(Boolean) as {
      id: string;
      time: string;
      patientName: string;
      reason: string | null;
      status: string;
    }[];

    const upcomingFiltered = mappedUpcoming.filter(
      (a) => new Date(a.time).getTime() >= now.getTime()
    );

    const nextAppointment = upcomingFiltered[0] ?? null;
    const upcomingToday = nextAppointment
      ? upcomingFiltered.slice(1)
      : upcomingFiltered;

    const inClinicNow = checkedInCount;
    const completedToday = doneCount;
    const cancellationsToday = cancelledCount;

    // ---- Orders summary & revenue ----------------------------------------
    const todayOrdersFilter: any = {
      createdAt: { $gte: todayStart, $lte: todayEnd },
    };

    const monthOrdersFilter: any = {
      createdAt: { $gte: monthStart, $lte: monthEnd },
    };

    const [
      pendingPickup,
      todayNew,
      nextOrderDoc,
      todayCompletedOrders,
      monthCompletedOrders,
    ] = await Promise.all([
      ordersCol.countDocuments({
        status: { $in: ["pending", "preparing", "ready"] },
      }),
      ordersCol.countDocuments(todayOrdersFilter),
      ordersCol
        .find({
          status: { $in: ["pending", "preparing", "ready"] },
        })
        .sort({ createdAt: 1 })
        .limit(1)
        .toArray()
        .then((arr) => arr[0] ?? null),
      ordersCol
        .find({
          ...todayOrdersFilter,
          status: "completed",
        })
        .toArray(),
      ordersCol
        .find({
          ...monthOrdersFilter,
          status: "completed",
        })
        .toArray(),
    ]);

    const nextOrder = nextOrderDoc
      ? {
          id: String(nextOrderDoc._id),
          orderNumber: nextOrderDoc.orderNumber ?? "—",
          patientName: nextOrderDoc.patientName ?? null,
          total: nextOrderDoc.total ?? 0,
          status: nextOrderDoc.status,
        }
      : null;

    const revenueToday = todayCompletedOrders.reduce(
      (sum, o) => sum + (o.total ?? 0),
      0
    );
    const revenueMonth = monthCompletedOrders.reduce(
      (sum, o) => sum + (o.total ?? 0),
      0
    );
    const completedOrdersToday = todayCompletedOrders.length;

    // ---- Stock signals ----------------------------------------------------
    const [criticalCount, lowCount, topCriticalDocs] = await Promise.all([
      productsCol.countDocuments({
        status: "active",
        qty: { $lte: 2 },
      } as any),
      productsCol.countDocuments({
        status: "active",
        qty: { $gt: 2, $lte: 10 },
      } as any),
      productsCol
        .find({
          status: "active",
          qty: { $lte: 2 },
        } as any)
        .sort({ qty: 1 })
        .limit(5)
        .toArray(),
    ]);

    const topCritical = topCriticalDocs.map((p) => ({
      name: p.name,
      slug: p.slug,
      qty: p.qty,
    }));

    // ---- Patients count ---------------------------------------------------
    const totalPatients = await usersCol.countDocuments({
      role: { $in: ["PATIENT", "patient", "Patient"] },
    });

    return NextResponse.json({
      todayAppointmentsTotal,
      todayByStatus,
      inClinicNow,
      completedToday,
      cancellationsToday,
      nextAppointment,
      upcomingToday,
      shopOrders: {
        pendingPickup,
        todayNew,
        completedToday: completedOrdersToday,
        nextOrder,
      },
      stockSignals: {
        critical: criticalCount,
        low: lowCount,
        topCritical,
      },
      revenueToday,
      revenueMonth,
      totalPatients,
    });
  } catch (err) {
    console.error("[GET /api/staff/summary] error:", err);
    return NextResponse.json(
      { error: "Failed to load staff summary" },
      { status: 500 }
    );
  }
}

/* --- helpers -------------------------------------------------------------- */

function pickStart(a: any): Date | null {
  if (a.start instanceof Date) return a.start;
  if (a.date instanceof Date) return a.date;
  if (a.createdAt instanceof Date) return a.createdAt;
  return null;
}

function pickPatientName(a: any): string {
  return (
    a.patientName ||
    a.patient_name ||
    a.patient_full_name ||
    a.patientFullName ||
    "Patient"
  );
}
