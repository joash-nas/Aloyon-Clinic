"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession, signOut } from "next-auth/react";

type Sex = "male" | "female" | "other" | "prefer_not_to_say";

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

type Profile = {
  fullName?: string | null;
  dob?: string | null;
  phone?: string | null;
  address?: string | null;
  sex?: Sex | null;
};

type MePayload = {
  ok: boolean;
  user?: {
    id?: string | null;
    email?: string | null;
    role?: string | null;
    name?: string | null;
    profile?: Profile | null;
  };
  error?: string;
};

type UpdateResp = { ok: boolean; error?: string };

export default function ProfileSettingsPage() {
  const { status } = useSession();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [email, setEmail] = useState<string>("");
  const [role, setRole] = useState<string>("patient");

  const [profile, setProfile] = useState<Profile>({});
  const [draft, setDraft] = useState<Profile>({});

  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const computedAge = useMemo(
    () => ageFromDob(draft?.dob ?? profile?.dob),
    [draft?.dob, profile?.dob]
  );

  // Load current user
  useEffect(() => {
    if (status !== "authenticated") return;

    (async () => {
      try {
        setLoading(true);
        const r = await fetch("/api/users/me", { cache: "no-store" });
        const data: MePayload = await r.json();

        if (!r.ok || !data.ok || !data.user) {
          setErr(data.error ?? "Could not load profile.");
          setLoading(false);
          return;
        }

        setEmail(data.user.email ?? "");
        setRole((data.user.role as string) || "patient");

        const incoming = (data.user.profile ?? {}) as Profile;
        setProfile(incoming);
        setDraft(incoming);

        setErr(null);
        setLoading(false);
      } catch {
        setErr("Could not load profile.");
        setLoading(false);
      }
    })();
  }, [status]);

  const startEdit = () => {
    setDraft(profile || {});
    setEditing(true);
    setErr(null);
  };

  const cancelEdit = () => {
    setDraft(profile || {});
    setEditing(false);
    setErr(null);
  };

  const save = async () => {
    setErr(null);

    const body = {
      name: draft?.fullName ?? profile?.fullName ?? "",
      profile: {
        fullName: draft?.fullName ?? null,
        dob: draft?.dob ?? null,
        phone: draft?.phone ?? null,
        address: draft?.address ?? null,
        sex: draft?.sex ?? null,
      } as Profile,
    };

    try {
      const r = await fetch("/api/users/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data: UpdateResp = await r.json();
      if (!r.ok || !data.ok) {
        setErr(data.error ?? "Could not save profile.");
        return;
      }

      setProfile(body.profile);
      setDraft(body.profile);
      setEditing(false);
    } catch {
      setErr("Network error. Please try again.");
    }
  };

  // Delete account (patients only)
  const handleDeleteAccount = async () => {
    if (role !== "patient") return;

    const confirm1 = window.confirm(
      "Are you sure you want to delete your account? This cannot be undone."
    );
    if (!confirm1) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch("/api/profile", { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };

      if (!res.ok || !data.ok) {
        setDeleteError(
          data.error ??
            "Could not delete your account. Please check your orders and try again."
        );
        setDeleting(false);
        return;
      }

      await signOut({ callbackUrl: "/login" });
    } catch {
      setDeleteError("Network error. Please try again.");
      setDeleting(false);
    }
  };

  const label = "text-xs text-muted";
  const borderedBlock =
    "mt-1 w-full rounded-xl px-3 py-2 outline-none bg-white/90 ring-1 ring-gray-200 focus:ring-[var(--primary)] disabled:bg-transparent disabled:ring-gray-100";

  const currentSex = editing ? draft?.sex ?? "" : profile?.sex ?? "";
  const displayName =
    profile?.fullName ||
    (role === "patient" ? "Unnamed patient" : "Unnamed user");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-[var(--primary)]/15 grid place-items-center select-none">
            <span className="text-sm">👤</span>
          </div>
          <div>
            <div className="text-sm font-medium">{displayName}</div>
            <div className="text-xs text-muted">{email}</div>
          </div>
          <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
            {role}
          </span>
        </div>

        {role === "patient" && !editing ? (
          <button
            onClick={startEdit}
            className="px-3 py-1.5 rounded-xl text-sm bg-white/70 ring-1 ring-[var(--border)] hover:bg-white"
          >
            Edit
          </button>
        ) : role === "patient" ? (
          <div className="flex gap-2">
            <button
              onClick={cancelEdit}
              className="px-3 py-1.5 rounded-xl text-sm bg-white/70 ring-1 ring-[var(--border)] hover:bg-white"
            >
              Cancel
            </button>
            <button
              onClick={save}
              className="px-3 py-1.5 rounded-xl text-sm text-white"
              style={{ background: "#6d72fe" }}
            >
              Save changes
            </button>
          </div>
        ) : null}
      </div>

      {/* Personal Details Card */}
      <div className="rounded-2xl p-5 bg-white/80 ring-1 ring-[var(--border)]">
        <div className="mb-4">
          <div className="text-sm font-semibold">Personal details</div>
          <div className="text-xs text-muted">
            {role === "patient"
              ? "Your name and birthday are used on prescriptions and appointments."
              : ""}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className={label}>Full name</div>
            <input
              className={borderedBlock}
              placeholder="Juan Dela Cruz"
              value={
                role === "patient"
                  ? editing
                    ? draft?.fullName ?? ""
                    : profile?.fullName ?? ""
                  : profile?.fullName ?? ""
              }
              onChange={(e) => {
                if (role !== "patient" || !editing) return;
                const v = e.currentTarget.value; // capture first
                setDraft((d) => ({ ...(d || {}), fullName: v }));
              }}
              disabled={role !== "patient" || !editing}
            />
          </div>

          <div>
            <div className={label}>Date of birth</div>
            <input
              type="date"
              className={borderedBlock}
              value={
                role === "patient"
                  ? editing
                    ? draft?.dob ?? ""
                    : profile?.dob ?? ""
                  : profile?.dob ?? ""
              }
              onChange={(e) => {
                if (role !== "patient" || !editing) return;
                const v = e.currentTarget.value; // capture first
                setDraft((d) => ({ ...(d || {}), dob: v || null }));
              }}
              disabled={role !== "patient" || !editing}
            />
          </div>

          <div>
            <div className={label}>Phone</div>
            <input
              className={borderedBlock}
              placeholder="(+63) 9xx xxx xxxx"
              value={
                role === "patient"
                  ? editing
                    ? draft?.phone ?? ""
                    : profile?.phone ?? ""
                  : profile?.phone ?? ""
              }
              onChange={(e) => {
                if (role !== "patient" || !editing) return;
                const v = e.currentTarget.value; // capture first
                setDraft((d) => ({ ...(d || {}), phone: v }));
              }}
              disabled={role !== "patient" || !editing}
            />
          </div>

          <div>
            <div className={label}>Age</div>
            <input
              className={borderedBlock}
              value={role === "patient" ? String(computedAge ?? "—") : "—"}
              readOnly
              disabled
            />
          </div>

          <div>
            <div className={label}>Sex</div>
            <select
              className={borderedBlock}
              value={currentSex || ""}
              onChange={(e) => {
                if (role !== "patient" || !editing) return;
                const v = e.currentTarget.value as Sex | "";
                setDraft((d) => ({ ...(d || {}), sex: (v || null) as Sex | null }));
              }}
              disabled={role !== "patient" || !editing}
            >
              <option value="">—</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <div className={label}>Address</div>
            <textarea
              className={borderedBlock}
              rows={3}
              placeholder="Street, City / Municipality, Province"
              value={
                role === "patient"
                  ? editing
                    ? draft?.address ?? ""
                    : profile?.address ?? ""
                  : profile?.address ?? ""
              }
              onChange={(e) => {
                if (role !== "patient" || !editing) return;
                const v = e.currentTarget.value; // capture first
                setDraft((d) => ({ ...(d || {}), address: v }));
              }}
              disabled={role !== "patient" || !editing}
            />
          </div>
        </div>

        {err && <div className="mt-3 text-sm text-red-600">{err}</div>}
        {loading && <div className="mt-3 text-xs text-muted">Loading…</div>}
      </div>

      {/* Appearance section */}
      <div className="rounded-2xl p-5 bg-white/80 ring-1 ring-[var(--border)]">
        <div className="text-sm font-semibold">Appearance</div>
        <div className="text-xs text-muted">
          Your theme preference is saved on this device.
        </div>
        <div className="mt-2 text-sm">
          Theme <span className="ml-1">🌞</span>
        </div>
      </div>

      {/* Danger zone — only for patients */}
      {role === "patient" && (
        <div className="rounded-2xl p-5 bg-red-50/70 ring-1 ring-red-100">
          <div className="text-sm font-semibold text-red-700">Delete account</div>
          <div className="text-xs text-red-700/80 mt-1">
            This will permanently delete your patient account. You cannot delete your
            account if you still have an order with status PREPARING or READY.
          </div>

          <button
            onClick={handleDeleteAccount}
            disabled={deleting}
            className="mt-3 px-4 py-2 rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-60"
          >
            {deleting ? "Deleting…" : "Delete my account"}
          </button>

          {deleteError && (
            <div className="mt-2 text-xs text-red-700">{deleteError}</div>
          )}
        </div>
      )}
    </div>
  );
}