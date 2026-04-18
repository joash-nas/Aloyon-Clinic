// src/app/reset-password/ResetPasswordClient.tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Props = {
  initialToken: string;
};

// Strong password policy (match your register + API)
function passwordPolicy(pw: string) {
  const checks = {
    length: pw.length >= 8,
    lower: /[a-z]/.test(pw),
    upper: /[A-Z]/.test(pw),
    number: /\d/.test(pw),
    symbol: /[^A-Za-z0-9]/.test(pw),
    noSpace: !/\s/.test(pw),
  };
  const ok = Object.values(checks).every(Boolean);
  return { ok, checks };
}

export default function ResetPasswordClient({ initialToken }: Props) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const hasToken = !!initialToken;
  const pw = useMemo(() => passwordPolicy(password), [password]);
  const match = password.length > 0 && password === confirm;

  const checkText = (ok: boolean) => (ok ? "text-emerald-700" : "text-muted");
  const checkDot = (ok: boolean) => (ok ? "✓" : "•");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!hasToken) {
      setErr(
        "Missing reset token. Please open the latest reset link from your email."
      );
      return;
    }

    if (!password) {
      setErr("Please enter a new password.");
      return;
    }

    if (!pw.ok) {
      setErr(
        "Password must be at least 8 characters and include uppercase, lowercase, number, and a special character (no spaces)."
      );
      return;
    }

    if (!match) {
      setErr("Passwords do not match.");
      return;
    }

    setBusy(true);
    setErr(null);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: initialToken,
          password,
        }),
      });

      const data = await res.json().catch(() => ({ ok: false }));
      if (!res.ok || !data.ok) {
        // shows exact server message (zod message)
        setErr(data.error ?? "Unable to reset password. Please try again.");
        setDone(false);
      } else {
        setDone(true);
      }
    } catch {
      setErr("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = hasToken && !done && pw.ok && match && !busy;

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
        <h1 className="text-xl font-semibold mb-2">Set a new password</h1>
        <p className="text-xs text-muted mb-4">
          Choose a new password for your Aloyon Optical account.
        </p>

        {!hasToken && (
          <div className="mb-3 text-xs px-3 py-2 rounded-xl bg-red-50 text-red-700">
            Reset token is missing or invalid. Please use the latest reset link
            sent to your email.
          </div>
        )}

        {done && (
          <div className="mb-3 text-xs px-3 py-2 rounded-xl bg-[var(--primary)]/20 text-[var(--primary-ink)]">
            Your password has been updated. You can now{" "}
            <Link href="/login" className="underline">
              sign in
            </Link>{" "}
            with your new password.
          </div>
        )}

        {err && !done && (
          <div className="mb-3 text-sm" style={{ color: "#b10d0d" }}>
            {err}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-muted">New password</label>
            <input
              type="password"
              required
              minLength={8}
              className="mt-1 w-full rounded-xl px-3 py-2 ring-1 ring-[var(--border)] bg-white/90 outline-none focus:ring-[var(--primary)]"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={!hasToken || done}
              autoComplete="new-password"
            />

            {/* Live password rules */}
            <div className="mt-2 text-[11px] space-y-1">
              <div className={checkText(pw.checks.length)}>
                {checkDot(pw.checks.length)} At least 8 characters
              </div>
              <div className={checkText(pw.checks.upper)}>
                {checkDot(pw.checks.upper)} At least 1 uppercase letter
              </div>
              <div className={checkText(pw.checks.lower)}>
                {checkDot(pw.checks.lower)} At least 1 lowercase letter
              </div>
              <div className={checkText(pw.checks.number)}>
                {checkDot(pw.checks.number)} At least 1 number
              </div>
              <div className={checkText(pw.checks.symbol)}>
                {checkDot(pw.checks.symbol)} At least 1 special character
              </div>
              <div className={checkText(pw.checks.noSpace)}>
                {checkDot(pw.checks.noSpace)} No spaces
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted">Confirm new password</label>
            <input
              type="password"
              required
              minLength={8}
              className="mt-1 w-full rounded-xl px-3 py-2 ring-1 ring-[var(--border)] bg-white/90 outline-none focus:ring-[var(--primary)]"
              placeholder="Re-type your new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={!hasToken || done}
              autoComplete="new-password"
            />

            {confirm.length > 0 && !match && (
              <div className="mt-1 text-[11px]" style={{ color: "#b10d0d" }}>
                Passwords do not match.
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full mt-2 rounded-xl px-4 py-2 font-medium transition"
            style={{
              background: "#111",
              color: "#fff",
              opacity: canSubmit ? 1 : 0.7,
            }}
          >
            {busy ? "Updating…" : "Update password"}
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