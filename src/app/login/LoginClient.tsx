/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/login/LoginClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, getSession, useSession } from "next-auth/react";
import { resolveAfterLogin } from "@/lib/roles";

type Props = { redirectTo?: string | null };

function ageFromDob(dob?: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age < 0 || age > 120 ? null : age;
}

function isEmailLike(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

// Must match server rules
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

type LoginStep = "credentials" | "otp";

export default function LoginClient({ redirectTo }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();

  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [step, setStep] = useState<LoginStep>("credentials");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // 2FA state
  const [twoFactorToken, setTwoFactorToken] = useState<string | null>(null);
  const [otp, setOtp] = useState("");

  // signup fields (first/last name)
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState(""); // YYYY-MM-DD
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [sex, setSex] = useState<
    "male" | "female" | "other" | "prefer_not_to_say"
  >("male");

  const computedAge = useMemo(() => ageFromDob(dob), [dob]);
  const pw = useMemo(() => passwordPolicy(password), [password]);

  const fullName = useMemo(() => {
    const f = firstName.trim();
    const l = lastName.trim();
    return `${f} ${l}`.trim().replace(/\s+/g, " ");
  }, [firstName, lastName]);

  // If already authenticated, redirect to proper dashboard
  useEffect(() => {
    (async () => {
      if (status !== "authenticated") return;
      const sess = await getSession();
      const role = (sess?.user as any)?.role ?? null;
      const dest = resolveAfterLogin(role, redirectTo ?? undefined);
      router.replace(dest);
    })();
  }, [status, redirectTo, router]);

  // Show messages when coming from verify-email redirect
  useEffect(() => {
    const v = searchParams?.get("verified");
    if (v === "1") {
      setNotice("Your email has been verified. You can now sign in.");
      setTab("signin");
    } else if (v === "invalid") {
      setNotice(
        "Verification link is invalid or has expired. Please request a new one."
      );
      setTab("signin");
    } else if (v === "missing") {
      setNotice("Missing verification token. Please use the latest email link.");
      setTab("signin");
    }
  }, [searchParams]);

  async function afterAuthRoute() {
    const sess = await getSession();
    const role = (sess?.user as any)?.role ?? null;
    const dest = resolveAfterLogin(role, redirectTo ?? undefined);
    router.replace(dest);
  }

  // ---- SIGN IN (STEP 1: credentials, STEP 2: OTP) ------------------------

  async function signInEmail() {
    if (!email || !password) {
      setErr("Please enter your email and password.");
      return;
    }

    setBusy(true);
    setErr(null);
    setNotice(null);
    setStep("credentials");
    setTwoFactorToken(null);
    setOtp("");

    try {
      const res = await fetch("/api/auth/login-start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({ ok: false }));
      if (!res.ok || !data.ok) {
        setErr(data.error ?? "Invalid email or password.");
        return;
      }

      if (data.mode === "direct") {
        const nextRes = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });
        if (!nextRes?.ok) {
          setErr("Invalid email or password.");
          return;
        }
        await afterAuthRoute();
        return;
      }

      if (data.mode === "2fa" && typeof data.token === "string") {
        setTwoFactorToken(data.token);
        setStep("otp");
        setNotice(
          `We sent a 6-digit sign-in code to ${email}. Please enter it below.`
        );
        setOtp("");
        return;
      }

      setErr("Unexpected response from server.");
    } catch {
      setErr("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp() {
    if (!twoFactorToken) {
      setErr("Missing verification state. Please try signing in again.");
      setStep("credentials");
      return;
    }
    if (!otp.trim()) {
      setErr("Please enter the 6-digit code.");
      return;
    }

    setBusy(true);
    setErr(null);
    setNotice(null);

    try {
      const res = await fetch("/api/auth/login-verify-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: twoFactorToken, code: otp.trim() }),
      });

      const data = await res.json().catch(() => ({ ok: false }));
      if (!res.ok || !data.ok) {
        setErr(data.error ?? "Invalid or expired code.");
        return;
      }

      const nextRes = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (!nextRes?.ok) {
        setErr("Login failed after 2FA. Please try again.");
        return;
      }

      await afterAuthRoute();
    } catch {
      setErr("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // ---- SIGN UP -----------------------------------------------------------

  type RegisterResp = { ok: boolean; error?: string };

  async function signUpEmail() {
    setBusy(true);
    setErr(null);
    setNotice(null);

    // require ALL fields
    const missing: string[] = [];
    if (!firstName.trim()) missing.push("First name");
    if (!lastName.trim()) missing.push("Last name");
    if (!email.trim()) missing.push("Email");
    if (!dob) missing.push("Date of birth");
    if (!phone.trim()) missing.push("Phone");
    if (!address.trim()) missing.push("Address");
    if (!password) missing.push("Password");

    if (missing.length) {
      setBusy(false);
      setErr(`Please fill in all required fields: ${missing.join(", ")}.`);
      return;
    }

    if (!isEmailLike(email)) {
      setBusy(false);
      setErr("Please enter a valid email address.");
      return;
    }

    const age = ageFromDob(dob);
    if (age === null) {
      setBusy(false);
      setErr("Please enter a valid date of birth.");
      return;
    }

    if (!pw.ok) {
      setBusy(false);
      setErr(
        "Password must be at least 8 characters and include uppercase, lowercase, number, and a special character (no spaces)."
      );
      return;
    }

    try {
      const r = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // keep name for compatibility (server also derives from first/last)
          name: fullName,
          email: email.trim(),
          password,
          profile: {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            dob,
            phone: phone.trim(),
            address: address.trim(),
            sex,
          },
        }),
      });

      const data: RegisterResp = await r.json().catch(() => ({
        ok: false,
        error: "Network error",
      }));

      if (!r.ok || !data.ok) {
        setBusy(false);
        setErr(data.error ?? "Could not create account.");
        return;
      }

      setBusy(false);
      setTab("signin");
      setPassword("");
      setNotice(
        "Account created! Please check your email and click the verification link before signing in."
      );
      setErr(null);
    } catch {
      setBusy(false);
      setErr("Network error. Please try again.");
    }
  }

  // ---- RENDER ------------------------------------------------------------

  const checkText = (ok: boolean) => (ok ? "text-emerald-700" : "text-muted");
  const checkDot = (ok: boolean) => (ok ? "✓" : "•");

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
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => {
              setTab("signin");
              setErr(null);
              setStep("credentials");
              setTwoFactorToken(null);
              setOtp("");
            }}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${
              tab === "signin"
                ? "bg-[var(--primary)]"
                : "bg-white/70 ring-1 ring-[var(--border)]"
            }`}
          >
            Sign in
          </button>
          <button
            onClick={() => {
              setTab("signup");
              setErr(null);
              setStep("credentials");
              setTwoFactorToken(null);
              setOtp("");
            }}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${
              tab === "signup"
                ? "bg-[var(--primary)]"
                : "bg-white/70 ring-1 ring-[var(--border)]"
            }`}
          >
            Create account
          </button>
        </div>

        {/* Notices & errors */}
        {notice && (
          <div className="mb-3 text-xs px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700">
            {notice}
          </div>
        )}
        {err && (
          <div className="mb-3 text-sm" style={{ color: "#b10d0d" }}>
            {err}
          </div>
        )}

        {tab === "signin" ? (
          step === "credentials" ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted">Email</label>
                <input
                  type="email"
                  className="mt-1 w-full rounded-xl px-3 py-2 ring-1 ring-[var(--border)] bg-white/90 outline-none focus:ring-[var(--primary)]"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.currentTarget.value)}
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="text-xs text-muted">Password</label>
                <input
                  type="password"
                  className="mt-1 w-full rounded-xl px-3 py-2 ring-1 ring-[var(--border)] bg-white/90 outline-none focus:ring-[var(--primary)]"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.currentTarget.value)}
                  autoComplete="current-password"
                />
              </div>

              <button
                onClick={signInEmail}
                disabled={busy}
                className="w-full mt-2 rounded-xl px-4 py-2 font-medium transition"
                style={{ background: "#a6bf2a" }}
              >
                {busy ? "Signing in…" : "Sign in"}
              </button>

              <div className="text-xs text-muted text-right mt-2">
                <a href="/forgot-password" className="underline">
                  Forgot password?
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted">
                  Enter 6-digit sign-in code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  className="mt-1 w-full rounded-xl px-3 py-2 ring-1 ring-[var(--border)] bg-white/90 outline-none focus:ring-[var(--primary)] tracking-[0.35em] text-center"
                  placeholder="••••••"
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.currentTarget.value.replace(/\D/g, ""))
                  }
                />
              </div>

              <button
                onClick={verifyOtp}
                disabled={busy || !otp}
                className="w-full mt-2 rounded-xl px-4 py-2 font-medium transition"
                style={{ background: "#111", color: "#fff" }}
              >
                {busy ? "Verifying…" : "Verify code & sign in"}
              </button>

              <div className="flex justify-between text-[11px] text-muted mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setStep("credentials");
                    setTwoFactorToken(null);
                    setOtp("");
                    setNotice(null);
                  }}
                  className="underline"
                >
                  Use a different account
                </button>
                <span>Didn&apos;t receive the code? Check your spam folder.</span>
              </div>
            </div>
          )
        ) : (
          <div className="space-y-3">
            {/* First + Last name */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted">First name</label>
                <input
                  className="mt-1 w-full rounded-xl px-3 py-2 ring-1 ring-[var(--border)] bg-white/90 outline-none focus:ring-[var(--primary)]"
                  placeholder="Juan"
                  value={firstName}
                  onChange={(e) => setFirstName(e.currentTarget.value)}
                />
              </div>
              <div>
                <label className="text-xs text-muted">Last name</label>
                <input
                  className="mt-1 w-full rounded-xl px-3 py-2 ring-1 ring-[var(--border)] bg-white/90 outline-none focus:ring-[var(--primary)]"
                  placeholder="Dela Cruz"
                  value={lastName}
                  onChange={(e) => setLastName(e.currentTarget.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted">Email</label>
              <input
                type="email"
                className="mt-1 w-full rounded-xl px-3 py-2 ring-1 ring-[var(--border)] bg-white/90 outline-none focus:ring-[var(--primary)]"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                autoComplete="email"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted">Date of birth</label>
                <input
                  type="date"
                  className="mt-1 w-full rounded-xl px-3 py-2 ring-1 ring-[var(--border)] bg-white/90 outline-none focus:ring-[var(--primary)]"
                  value={dob}
                  onChange={(e) => setDob(e.currentTarget.value)}
                />
              </div>
              <div>
                <label className="text-xs text-muted">Age</label>
                <input
                  disabled
                  className="mt-1 w-full rounded-xl px-3 py-2 ring-1 ring-[var(--border)] bg-gray-50 text-gray-600"
                  value={computedAge ?? ""}
                  placeholder="—"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted">Sex</label>
              <select
                className="mt-1 w-full rounded-xl px-3 py-2 ring-1 ring-[var(--border)] bg-white/90 outline-none focus:ring-[var(--primary)]"
                value={sex}
                onChange={(e) =>
                  setSex(
                    e.currentTarget.value as
                      | "male"
                      | "female"
                      | "other"
                      | "prefer_not_to_say"
                  )
                }
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-muted">Phone</label>
              <input
                className="mt-1 w-full rounded-xl px-3 py-2 ring-1 ring-[var(--border)] bg-white/90 outline-none focus:ring-[var(--primary)]"
                placeholder="09xxxxxxxxx"
                value={phone}
                onChange={(e) => setPhone(e.currentTarget.value)}
                inputMode="tel"
              />
            </div>

            <div>
              <label className="text-xs text-muted">Address</label>
              <input
                className="mt-1 w-full rounded-xl px-3 py-2 ring-1 ring-[var(--border)] bg-white/90 outline-none focus:ring-[var(--primary)]"
                placeholder="Street, Barangay, City, Province"
                value={address}
                onChange={(e) => setAddress(e.currentTarget.value)}
              />
            </div>

            <div>
              <label className="text-xs text-muted">Password</label>
              <input
                type="password"
                className="mt-1 w-full rounded-xl px-3 py-2 ring-1 ring-[var(--border)] bg-white/90 outline-none focus:ring-[var(--primary)]"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                autoComplete="new-password"
              />

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

            <button
              onClick={signUpEmail}
              disabled={busy || !pw.ok}
              className="w-full mt-2 rounded-xl px-4 py-2 font-medium transition"
              style={{
                background: "#111",
                color: "#fff",
                opacity: busy || !pw.ok ? 0.7 : 1,
              }}
              title={
                !pw.ok ? "Password must meet all requirements above." : undefined
              }
            >
              {busy ? "Creating…" : "Create account"}
            </button>

          </div>
        )}
      </div>
    </div>
  );
}