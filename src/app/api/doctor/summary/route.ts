/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const dynamic = "force-dynamic";

type AppointmentDoc = {
  _id: any;
  doctorId?: string;
  doctor_id?: string;
  status?: string;
  day?: string;   // "YYYY-MM-DD"
  time?: string;  // "HH:MM"
  createdAt?: Date;
  reason?: string | null;
  patientId?: string;
  patientName?: string;
  patient_email?: string;
  patient_name?: string;
  patient_full_name?: string;
};

export async function GET(_req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const userId = session.user.id as string;
    const db = await getDb();
    const apptCol = db.collection<AppointmentDoc>("appointments");

    const now = new Date();

    
    const doctorFilter: any = {
      $or: [{ doctorId: userId }, { doctor_id: userId }],
    };

    const hasDoctorDocs = await apptCol.countDocuments(doctorFilter);
    const baseDoctorFilter: any = hasDoctorDocs > 0 ? doctorFilter : {};
    

   
    const todayStr = toDayStr(now);

    const year = now.getFullYear();
    const month = now.getMonth(); // 0-based
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0); // last day of month

    const monthStartStr = toDayStr(monthStart); 
    const monthEndStr = toDayStr(monthEnd);     

  
    const todayFilter: any = {
      ...baseDoctorFilter,
      day: todayStr,
    };

    const [
      todayAppointmentsTotal,
      pendingCount,
      confirmedCount,
      checkedInCount,
      doneCount,
      cancelledCount,
    ] = await Promise.all([
      apptCol.countDocuments(todayFilter),
      apptCol.countDocuments({ ...todayFilter, status: "booked" }),
      apptCol.countDocuments({ ...todayFilter, status: "confirmed" }),
      apptCol.countDocuments({ ...todayFilter, status: "checked-in" }),
      apptCol.countDocuments({
        ...todayFilter,
        status: { $in: ["done", "completed"] },
      }),
      apptCol.countDocuments({ ...todayFilter, status: "cancelled" }),
    ]);

    const todayByStatus = {
      pending: pendingCount,
      confirmed: confirmedCount,
      checkedIn: checkedInCount,
      done: doneCount,
      cancelled: cancelledCount,
    };

    const inClinicNow = checkedInCount;
    const completedToday = doneCount;
    const cancellationsToday = cancelledCount;

    //  Upcoming queue 
    const upcomingFilter: any = {
      ...baseDoctorFilter,
      status: { $in: ["booked", "confirmed", "checked-in"] },
      day: { $gte: todayStr },
    };

    const upcomingDocs = await apptCol
      .find(upcomingFilter)
      .sort({ day: 1, time: 1, _id: 1 })
      .limit(16)
      .toArray();

    const mappedUpcoming = upcomingDocs
      .map((doc) => {
        const a: any = doc;
        const at = combineDayTime(a.day, a.time);
        if (!at) return null;
        return {
          id: String(a._id),
          time: at.toISOString(), 
          patientName: pickPatientName(a),
          reason: (a.reason as string | null) ?? null,
          status: (a.status as string) || "booked",
        };
      })
      .filter(Boolean) as {
      id: string;
      time: string;
      patientName: string;
      reason: string | null;
      status: string;
    }[];

    const nextAppointment = mappedUpcoming[0] ?? null;
    const upcomingToday = mappedUpcoming.slice(1);

    // Month stats 
    const monthFilter: any = {
      ...baseDoctorFilter,
      day: { $gte: monthStartStr, $lte: monthEndStr },
      status: { $in: ["done", "completed"] },
    };

    const monthDocs = await apptCol.find(monthFilter).toArray();

    const visitsThisMonth = monthDocs.length;
    const patientSet = new Set<string>();
    monthDocs.forEach((a: any) => {
      if (typeof a.patientId === "string") {
        patientSet.add(a.patientId);
      } else if (a.patient_email) {
        patientSet.add(String(a.patient_email));
      }
    });
    const patientsThisMonth = patientSet.size;

    // Final JSON 
    return NextResponse.json({
      todayAppointmentsTotal,
      todayByStatus,
      inClinicNow,
      completedToday,
      cancellationsToday,
      nextAppointment,
      upcomingToday,
      patientsThisMonth,
      visitsThisMonth,
    });
  } catch (err) {
    console.error("[GET /api/doctor/summary] error:", err);
    return NextResponse.json(
      { error: "Failed to load doctor summary" },
      { status: 500 }
    );
  }
}

/* helpers */

function toDayStr(d: Date): string {
  const year = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const mm = m < 10 ? `0${m}` : String(m);
  const dd = day < 10 ? `0${day}` : String(day);
  return `${year}-${mm}-${dd}`; // "YYYY-MM-DD"
}

function combineDayTime(day?: string, time?: string): Date | null {
  if (!day) return null;
  const safeTime =
    time && /^\d{2}:\d{2}$/.test(time) ? time : "09:00";
  const iso = `${day}T${safeTime}:00`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d;
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
