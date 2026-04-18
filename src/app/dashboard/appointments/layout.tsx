"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";

export default function AppointmentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login?redirect=/dashboard/appointments");
  }, [user, loading, router]);

  if (loading || !user) return <div className="p-6">Loading…</div>;
  return <>{children}</>;
}
