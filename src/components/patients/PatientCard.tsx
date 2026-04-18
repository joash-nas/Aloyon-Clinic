"use client";

import { ageFromDob } from "@/lib/age";

type PatientProfile = {
  fullName?: string | null;
  dob?: string | null;        // "YYYY-MM-DD"
  phone?: string | null;
  address?: string | null;
};

export type PatientDoc = {
  _id: string;
  email: string;
  role: "patient" | string;
  profile?: PatientProfile | null;
};

export default function PatientCard({ patient }: { patient: PatientDoc }) {
  const p = patient.profile ?? {};
  const age = ageFromDob(p.dob);

  // chips/badges + gentle borders to match your current profile styling
  const chip = "px-2 py-[3px] rounded-full text-[11px] font-medium";
  const subtle = "text-muted text-[12px]";
  const field = "rounded-xl px-3 py-2 ring-1 ring-[var(--border)] bg-white/90";

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div
        className="flex items-center justify-between rounded-2xl px-4 py-3"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.9), rgba(255,255,255,0.8))",
          boxShadow: "0 14px 40px rgba(0,0,0,0.06), 0 6px 18px rgba(0,0,0,0.05)",
          border: "1px solid var(--border)",
        }}
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-indigo-100 text-indigo-600 grid place-items-center font-semibold">
            {p.fullName?.[0]?.toUpperCase() || "?"}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <div className="font-semibold text-[15px]">
                {p.fullName || "Unnamed patient"}
              </div>
              <span
                className={`${chip}`}
                style={{
                  background: "#eaf6e6",
                  color: "#1a7f37", // darker green for visibility
                  border: "1px solid #c7e7c9",
                }}
              >
                patient
              </span>
            </div>
            <div className="text-[12px] text-muted">{patient.email}</div>
          </div>
        </div>
      </div>

      {/* Personal details card */}
      <div
        className="rounded-2xl p-5"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.9), rgba(255,255,255,0.86))",
          boxShadow: "0 20px 60px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.05)",
          border: "1px solid var(--border)",
        }}
      >
        <div className="text-sm font-semibold mb-1">Personal details</div>
        <div className={subtle}>
          Your name and birthday are used on prescriptions and appointments.
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <div className={subtle}>Full name</div>
            <div className={`${field} mt-1`}>{p.fullName || "—"}</div>
          </div>
          <div>
            <div className={subtle}>Date of birth</div>
            <div className={`${field} mt-1`}>
              {p.dob || "—"}
            </div>
          </div>

          <div>
            <div className={subtle}>Phone</div>
            <div className={`${field} mt-1`}>{p.phone || "—"}</div>
          </div>
          <div>
            <div className={subtle}>Age</div>
            <div className={`${field} mt-1`}>{age ?? "—"}</div>
          </div>

          <div className="md:col-span-2">
            <div className={subtle}>Address</div>
            <div className={`${field} mt-1`}>{p.address || "—"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
