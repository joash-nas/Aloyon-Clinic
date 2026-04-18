"use client";

import { SessionProvider, useSession, signOut as nextSignOut } from "next-auth/react";
import type { Session } from "next-auth";
import type { Role } from "@/lib/roles";
import { ReactNode } from "react";

export function AuthProvider({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}

export function useAuth(): {
  user: (Session["user"] & { id?: string; role?: Role }) | null;
  session: Session | null;
  role: Role | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
} {
  const { data, status, update } = useSession();
  const user = data?.user as (Session["user"] & { id?: string; role?: Role }) | undefined;

  return {
    user: user ?? null,
    session: data ?? null,
    role: (user?.role as Role | undefined) ?? null,
    loading: status === "loading",
    refresh: async () => { await update(); },
    signOut: async () => { await nextSignOut({ callbackUrl: "/login" }); },
  };
}
