"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/AuthContext";
import SignOutButton from "@/components/auth/SignOutButton";
import CartLink from "@/components/cart/CartLink";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { isStaff, portalPathFromRole } from "@/lib/roles";

export default function HeaderActions() {
  const { user, role } = useAuth();
  const portalHref = portalPathFromRole(role);

  return (
    <nav className="flex items-center gap-2 sm:gap-3 text-sm">
      <ThemeToggle />

      {user && <CartLink />}

      {user ? (
        <>
          {role === "admin" && <Link href="/dashboard/users" className="btn btn-ghost">Admin</Link>}
          {isStaff(role) && <Link href="/staff" className="btn btn-ghost">Staff</Link>}
          <Link href={portalHref} className="btn btn-ghost">Portal</Link>
          <SignOutButton />
        </>
      ) : (
        <Link href="/login" className="btn btn-primary">Sign in</Link>
      )}
    </nav>
  );
}
