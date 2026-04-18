"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setSent(false);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json().catch(() => ({ ok: false }));
      if (!res.ok || !data.ok) {
        setErr(data.error ?? "Something went wrong.");
      } else {
        setSent(true);
      }
    } catch {
      setErr("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div
        className="w-full max-w-md rounded-2xl p-6 md:p-8"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.9), rgba(255,255,255,0.8))",
          boxShadow:
            "0 20px 60px rgba(0,0,0,0.10), 0 8px 24px rgba(0,0,0,0.06)",
          border: "1px solid var(--border)",
        }}
      >
        <h1 className="text-xl font-semibold mb-2">Reset your password</h1>
        <p className="text-xs text-muted mb-4">
          Enter the email linked to your Aloyon Optical account and we&apos;ll
          send you a link to set a new password.
        </p>

        {sent && (
          <div className="mb-3 text-xs px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700">
            If an account exists for <strong>{email}</strong>, a reset link has
            been sent. Please check your inbox (and spam folder).
          </div>
        )}

        {err && (
          <div className="mb-3 text-sm" style={{ color: "#b10d0d" }}>
            {err}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-muted">Email</label>
            <input
              type="email"
              required
              className="mt-1 w-full rounded-xl px-3 py-2 ring-1 ring-[var(--border)] bg-white/90 outline-none focus:ring-[var(--primary)]"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
            />
          </div>

          <button
            type="submit"
            disabled={busy || !email}
            className="w-full mt-2 rounded-xl px-4 py-2 font-medium transition"
            style={{ background: "#111", color: "#fff" }}
          >
            {busy ? "Sending…" : "Send reset link"}
          </button>
        </form>

        <div className="mt-4 text-xs text-muted text-center">
          <Link href="/login" className="underline">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
