"use client";

import { useAuth } from "./AuthContext";

export default function SignOutButton({ className = "" }: { className?: string }) {
  const { signOut } = useAuth();
  return (
    <button
      onClick={signOut}
      className={className || "btn btn-ghost"}
      title="Sign out"
    >
      Sign out
    </button>
  );
}
