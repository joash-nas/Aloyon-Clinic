// Renders children only when the signed-in user has a staff role.
// Keeps UI controls (like "Edit") hidden for customers.

"use client";

import { ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { isStaff } from "@/lib/roles";

export default function StaffOnly({ children }: { children: ReactNode }) {
  const { role } = useAuth();
  if (!role || !isStaff(role)) return null;
  return <>{children}</>;
}
