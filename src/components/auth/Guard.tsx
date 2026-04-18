// src/components/auth/Guard.tsx
"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";
import type { Role } from "@/lib/roles";

type Props = {
  children: React.ReactNode;
  /** If true, user must be signed in. */
  requireAuth?: boolean;
  /**
   * Allowed roles.
   * You can use either `requireRole` or `roles` (alias). `requireRole` takes precedence.
   */
  requireRole?: Role[];
  roles?: Role[]; // alias for backward/forward compat
  /** Override where unauthenticated users go. Defaults to /login?redirect=<current>. */
  redirectTo?: string;
  /** Optional loading UI while session is resolving. */
  loadingFallback?: React.ReactNode;
};

export default function Guard({
  children,
  requireAuth = false,
  requireRole,
  roles,
  redirectTo,
  loadingFallback = <div className="p-6 text-sm text-muted">Loading…</div>,
}: Props) {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // pick the prop we actually enforce
  const allowedRoles: Role[] | undefined = requireRole ?? roles;

  useEffect(() => {
    if (loading) return;

    // 1) Must be logged in?
    if (requireAuth && !user) {
      const dest =
        redirectTo || `/login?redirect=${encodeURIComponent(pathname || "/")}`;
      router.replace(dest);
      return;
    }

    // 2) Must have one of the allowed roles?
    if (
      allowedRoles &&
      allowedRoles.length > 0 &&
      (!role || !allowedRoles.includes(role))
    ) {
      // Not authorized → send somewhere safe
      router.replace("/dashboard");
      return;
    }
  }, [requireAuth, allowedRoles, redirectTo, user, role, loading, router, pathname]);

  if (loading) return loadingFallback;

  // While redirecting, render nothing
  if (requireAuth && !user) return null;
  if (
    allowedRoles &&
    allowedRoles.length > 0 &&
    (!role || !allowedRoles.includes(role))
  )
    return null;

  return <>{children}</>;
}
