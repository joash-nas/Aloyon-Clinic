// src/app/account/page.tsx
// Simple account page for logged-in users.
// Shows the current user's email and a sign-out button.

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";
import SignOutButton from "@/components/auth/SignOutButton";

export default function AccountPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  // If the user is not logged in, redirect sa login page.
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login?redirect=/account");
    }
  }, [loading, user, router]);

  if (loading) return <div className="p-6">Loading…</div>;

  // If still no user after loading, do not run the page.
  if (!user) return null;

  // Main account content
  return (
    <div className="max-w-2xl mx-auto py-10 space-y-4">
      <h1 className="text-2xl font-semibold">Account</h1>

      <div className="card p-4">
        <div className="text-sm text-muted">Signed in as</div>
        <div className="text-base font-medium">{user.email}</div>
      </div>

      <SignOutButton />
    </div>
  );
}
