// src/components/nav/AvatarMenu.tsx

"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import SignOutButton from "@/components/auth/SignOutButton";

function useOutside(
  ref: React.RefObject<HTMLElement | null>,
  onClose: () => void
) {
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) onClose();
    }

    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", esc);

    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", esc);
    };
  }, [onClose, ref]);
}

export default function AvatarMenu() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useOutside(ref, () => setOpen(false));

  if (!user) {
    return (
      <Link href="/login" className="btn btn-primary">
        Sign in
      </Link>
    );
  }

  const avatarUrl = user.image || undefined;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="w-9 h-9 rounded-full bg-[var(--muted)] flex items-center justify-center"
        title={user.email || "Account"}
        aria-label="Account menu"
        type="button"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt="Avatar"
            className="w-9 h-9 rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M12 12a5 5 0 1 0-5-5a5 5 0 0 0 5 5Zm0 2c-4.418 0-8 2.239-8 5v1h16v-1c0-2.761-3.582-5-8-5Z"
            />
          </svg>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-56 rounded-2xl overflow-hidden"
          style={{
            border: "1px solid var(--border)",
            background: "rgba(255,255,255,0.95)",
            boxShadow:
              "0 20px 60px rgba(0,0,0,0.10), 0 8px 24px rgba(0,0,0,0.06)",
          }}
        >
          <div className="px-3 py-2 text-xs opacity-70">{user.email}</div>

          <div className="grid">
            <Link
              href="/dashboard"
              className="px-3 py-2 hover:bg-black/5 text-sm"
            >
              Dashboard
            </Link>

            <Link
              href="/dashboard/profile"
              className="px-3 py-2 hover:bg-black/5 text-sm"
            >
              Settings
            </Link>

            <div className="h-px bg-[var(--border)] my-1" />
            <SignOutButton />
          </div>
        </div>
      )}
    </div>
  );
}