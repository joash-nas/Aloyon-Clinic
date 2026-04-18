/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/dashboard/page.tsx
"use client";

import { useAuth } from "@/components/auth/AuthContext";

import PatientOverview from "@/components/dashboard/overview/PatientOverview";
import AdminOverview from "@/components/dashboard/overview/AdminOverview";
import AssistantOverview from "@/components/dashboard/overview/AssistantOverview";
import DoctorOverview from "@/components/dashboard/overview/DoctorOverview";
import SalesOverview from "@/components/dashboard/overview/SalesOverview";
import SupplierOverview from "@/components/dashboard/overview/SupplierOverview";
import GenericOverview from "@/components/dashboard/overview/GenericOverview";

export default function DashboardHome() {
  const { role, user } = useAuth() as { role?: string; user?: any };

  // While auth is still loading
  if (!role) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-40 rounded bg-[var(--muted)] animate-pulse" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="card p-5 h-32 animate-pulse bg-[var(--muted)]" />
          <div className="card p-5 h-32 animate-pulse bg-[var(--muted)]" />
          <div className="card p-5 h-32 animate-pulse bg-[var(--muted)]" />
        </div>
      </div>
    );
  }

  switch (role) {
    case "patient":
      return <PatientOverview user={user} />;
    case "assistant":
      return <AssistantOverview user={user} />;
    case "admin":
      return <AdminOverview user={user}/>;
    case "doctor":
      return <DoctorOverview user={user}/>;
    case "sales":
      return <SalesOverview user={user}/>;
    case "supplier":
      return <SupplierOverview user={user}/>;
    default:
      return <GenericOverview role={role} />;
  }
}
