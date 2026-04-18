"use client";

import { useState } from "react";
import Guard from "@/components/auth/Guard";
import Sidebar from "@/components/dashboard/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <Guard requireAuth>
      {/* Mobile header inside dashboard */}
      <div className="lg:hidden mb-4">
        <button
          onClick={() => setOpen(!open)}
          className="btn btn-ghost"
          aria-expanded={open}
          aria-controls="dash-sidebar"
        >
          {open ? "Close menu" : "Open menu"}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* Sidebar */}
        <div
          id="dash-sidebar"
          className={[
            "lg:block",
            open ? "block" : "hidden",
            "rounded-2xl ring-1 ring-[var(--border)] bg-white/80 dark:bg-white/5"
          ].join(" ")}
        >
          <Sidebar />
        </div>

        {/* Content */}
        <section className="min-h-[60vh]">
          {children}
        </section>
      </div>
    </Guard>
  );
}
