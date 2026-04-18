"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";

type Patient = {
  id: string;
  email: string;
  role: string;
  fullName: string;
  dob: string | null;
  age: number | null;
  phone: string | null;
  address: string | null;
  sex?: "male" | "female" | "other" | "prefer_not_to_say" | null;
};

type Appt = {
  _id: string;
  day: string;
  time: string;
  date?: string;
  status?: "booked" | "done" | "cancelled" | string;
  notes?: string | null;
  createdAt?: string;
};

type DoctorNotes = {
  preScreening?: string;
  chiefComplaint?: string;
  monoPd?: string;
  binPd?: string;
  presentCorrectionVa?: string;
  visualRequirement?: string;
  ocularHistory?: string;
  lensTypeAgeCondition?: string;

  odVa?: string;
  odVaComment?: string;

  osVa?: string;
  osVaComment?: string;

  planManagement?: string;
  qualityCheck?: string;
};

type NotesPayload = {
  ok: boolean;
  notes?: DoctorNotes | null;
  lastUpdated?: string | null;
  error?: string;
};

type SaveNotesResp = {
  ok: boolean;
  changed?: boolean;
  updatedAt?: string | null;
  error?: string;
};

type PatientForm = {
  fullName: string;
  email: string;
  dob: string;
  phone: string;
  address: string;
  sex: "male" | "female" | "other" | "prefer_not_to_say" | "";
  password: string;
};

function safe(str?: string | null): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function computeAgeFromDob(dob?: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;

  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age < 0 ? null : age;
}

function EyeBlock({
  label,
  va,
  comment,
  onChangeVa,
  onChangeComment,
  disabled,
}: {
  label: string;
  va: string;
  comment: string;
  onChangeVa: (v: string) => void;
  onChangeComment: (v: string) => void;
  disabled: boolean;
}) {
  const inputCls =
    "mt-1 w-full rounded-xl border px-3 py-1.5 text-sm " +
    (disabled ? "bg-gray-50 text-gray-500 cursor-default" : "bg-white");

  const textareaCls =
    "mt-1 w-full rounded-xl border px-3 py-1.5 text-sm " +
    (disabled ? "bg-gray-50 text-gray-500 cursor-default" : "bg-white");

  return (
    <div className="border rounded-xl p-3 bg-white/80">
      <div className="flex items-center gap-1 text-xs font-medium mb-2">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-50 text-indigo-700 text-[11px]">
          {label}
        </span>
        <span className="text-neutral-700">VA</span>
      </div>

      <label className="text-[11px] text-neutral-600">VA</label>
      <input
        className={inputCls}
        value={va}
        onChange={(e) => onChangeVa(e.target.value)}
        placeholder="e.g. 20/20"
        disabled={disabled}
      />

      <label className="mt-3 text-[11px] text-neutral-600">Comment</label>
      <textarea
        className={textareaCls}
        rows={2}
        value={comment}
        onChange={(e) => onChangeComment(e.target.value)}
        placeholder="Notes about this eye…"
        disabled={disabled}
      />
    </div>
  );
}

type Tab = "profile" | "notes";

export default function PatientProfilePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { role } = useAuth();
  const isDoctor = role === "doctor";

  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [loadingAppts, setLoadingAppts] = useState(false);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [total, setTotal] = useState<number | undefined>(undefined);

  const [notesLoading, setNotesLoading] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<DoctorNotes | null>(null);
  const [notesOriginal, setNotesOriginal] = useState<DoctorNotes | null>(null);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>("profile");

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [form, setForm] = useState<PatientForm>({
    fullName: "",
    email: "",
    dob: "",
    phone: "",
    address: "",
    sex: "",
    password: "",
  });

  async function loadPatient() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/patients/${id}`, { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || `Failed (${res.status})`);
      const p = j.patient as Patient;
      setPatient(p);
      setForm({
        fullName: p.fullName || "",
        email: p.email || "",
        dob: p.dob || "",
        phone: p.phone || "",
        address: p.address || "",
        sex: p.sex || "",
        password: "",
      });
    } catch (e: any) {
      setError(e.message || "Failed to load patient");
    } finally {
      setLoading(false);
    }
  }

  async function loadBookedAppts() {
    if (!id) return;
    setLoadingAppts(true);
    try {
      const qs = new URLSearchParams({ scope: "booked", page: "1", limit: "10" });
      const res = await fetch(`/api/patients/${id}/appointments?${qs.toString()}`, {
        cache: "no-store",
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || `Failed (${res.status})`);
      setAppts((j?.items || []) as Appt[]);
      setTotal(typeof j?.total === "number" ? j.total : undefined);
    } catch {
      setAppts([]);
      setTotal(undefined);
    } finally {
      setLoadingAppts(false);
    }
  }

  async function loadNotes(allow: boolean) {
    if (!id || !allow) {
      setNotesDraft(null);
      setNotesOriginal(null);
      setLastUpdated(null);
      setNotesLoading(false);
      return;
    }
    setNotesLoading(true);
    setNotesError(null);
    setIsEditingNotes(false);
    try {
      const res = await fetch(`/api/patients/${id}/doctor-notes`, {
        cache: "no-store",
      });
      const j: NotesPayload = await res.json();
      if (!res.ok || !j.ok) {
        throw new Error(j.error || `Failed (${res.status})`);
      }
      const n = j.notes ?? {};
      setNotesDraft(n);
      setNotesOriginal(n);
      setLastUpdated(j.lastUpdated ?? null);
    } catch (e: any) {
      setNotesError(e.message || "Failed to load doctor notes");
      setNotesDraft({});
      setNotesOriginal({});
      setLastUpdated(null);
    } finally {
      setNotesLoading(false);
    }
  }

  async function saveNotes() {
    if (!id || !isDoctor || !isEditingNotes) return;

    setNotesSaving(true);
    setNotesError(null);
    try {
      const res = await fetch(`/api/patients/${id}/doctor-notes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notesDraft || {} }),
      });
      const j: SaveNotesResp = await res.json();
      if (!res.ok || !j.ok) {
        throw new Error(j.error || `Failed (${res.status})`);
      }

      if (j.changed && j.updatedAt) {
        setLastUpdated(j.updatedAt);
      }

      setNotesOriginal(notesDraft || {});
      setIsEditingNotes(false);
    } catch (e: any) {
      setNotesError(e.message || "Failed to save doctor notes");
    } finally {
      setNotesSaving(false);
    }
  }

  function cancelEditNotes() {
    setNotesDraft(notesOriginal || {});
    setIsEditingNotes(false);
    setNotesError(null);
  }

  function cancelEditProfile() {
    if (!patient) return;
    setForm({
      fullName: patient.fullName || "",
      email: patient.email || "",
      dob: patient.dob || "",
      phone: patient.phone || "",
      address: patient.address || "",
      sex: patient.sex || "",
      password: "",
    });
    setProfileError(null);
    setIsEditingProfile(false);
  }

  async function saveProfile() {
    if (!id) return;

    setProfileSaving(true);
    setProfileError(null);

    try {
      const res = await fetch(`/api/patients/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName,
          email: form.email,
          dob: form.dob,
          phone: form.phone,
          address: form.address,
          sex: form.sex || null,
          password: form.password,
        }),
      });

      const j = await res.json();
      if (!res.ok) {
        throw new Error(j?.error || "Failed to update patient.");
      }

      setIsEditingProfile(false);
      setForm((prev) => ({ ...prev, password: "" }));
      await loadPatient();
    } catch (e: any) {
      setProfileError(e.message || "Failed to update patient.");
    } finally {
      setProfileSaving(false);
    }
  }

  function printDoctorNotes() {
    if (!patient) return;
    const n: DoctorNotes = notesDraft || {};

    const win = window.open("", "_blank");
    if (!win) return;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Doctor notes – ${safe(patient.fullName)}</title>
          <style>
            body {
              font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              padding: 24px;
              color: #111827;
              font-size: 14px;
            }
            h1 { font-size: 20px; margin-bottom: 4px; }
            h2 { font-size: 16px; margin-top: 20px; margin-bottom: 8px; }
            .meta {
              font-size: 12px;
              color: #6b7280;
              margin-bottom: 16px;
            }
            .section { margin-bottom: 16px; }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 4px;
            }
            th, td {
              border: 1px solid #e5e7eb;
              padding: 4px 6px;
              text-align: left;
            }
            th { background: #f3f4f6; }
          </style>
        </head>
        <body>
          <h1>Doctor Notes</h1>
          <div class="meta">
            Patient: ${safe(patient.fullName)} (${safe(patient.email)})<br/>
            Generated: ${new Date().toLocaleString()}
          </div>

          <div class="section">
            <h2>General</h2>
            <table>
              <tbody>
                <tr><th>Pre-screening</th><td>${safe(n.preScreening)}</td></tr>
                <tr><th>Chief complaint</th><td>${safe(n.chiefComplaint)}</td></tr>
                <tr><th>Mono PD</th><td>${safe(n.monoPd)}</td></tr>
                <tr><th>Bin PD</th><td>${safe(n.binPd)}</td></tr>
                <tr><th>Present correction &amp; VA</th><td>${safe(n.presentCorrectionVa)}</td></tr>
                <tr><th>Visual requirement</th><td>${safe(n.visualRequirement)}</td></tr>
                <tr><th>Ocular history</th><td>${safe(n.ocularHistory)}</td></tr>
                <tr><th>Lens type / age / condition</th><td>${safe(n.lensTypeAgeCondition)}</td></tr>
              </tbody>
            </table>
          </div>

          <div class="section">
            <h2>OD / OS VA</h2>
            <table>
              <thead>
                <tr>
                  <th>Eye</th>
                  <th>VA</th>
                  <th>Comment</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>OD</td>
                  <td>${safe(n.odVa)}</td>
                  <td>${safe(n.odVaComment)}</td>
                </tr>
                <tr>
                  <td>OS</td>
                  <td>${safe(n.osVa)}</td>
                  <td>${safe(n.osVaComment)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="section">
            <h2>Plan, management &amp; quality check</h2>
            <table>
              <tbody>
                <tr><th>Plan &amp; management</th><td>${safe(n.planManagement)}</td></tr>
                <tr><th>Quality check</th><td>${safe(n.qualityCheck)}</td></tr>
              </tbody>
            </table>
          </div>

          <script>
            window.onload = function () {
              window.focus();
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  useEffect(() => {
    void loadPatient();
    void loadBookedAppts();
    void loadNotes(isDoctor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isDoctor]);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-lg font-medium">Loading…</h1>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="p-6">
        <div className="text-rose-600">{error ?? "Not found"}</div>
      </div>
    );
  }

  const profileAge = computeAgeFromDob(form.dob);

  const sexLabel =
    patient.sex === "male"
      ? "Male"
      : patient.sex === "female"
      ? "Female"
      : patient.sex === "other"
      ? "Other"
      : patient.sex === "prefer_not_to_say"
      ? "Prefer not to say"
      : "—";

  const notesDisabled = !isEditingNotes;

  const textInputCls =
    "mt-1 w-full rounded-xl border px-3 py-2 text-sm " +
    (notesDisabled ? "bg-gray-50 text-gray-500 cursor-default" : "bg-white");

  const textAreaCls =
    "mt-1 w-full rounded-xl border px-3 py-2 text-sm " +
    (notesDisabled ? "bg-gray-50 text-gray-500 cursor-default" : "bg-white");

  const profileInputCls =
    "mt-1 w-full rounded-xl border px-3 py-2 text-sm " +
    (isEditingProfile ? "bg-white" : "bg-gray-50 text-gray-500 cursor-default");

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gray-200 grid place-items-center text-sm font-semibold">
            {patient.fullName?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">
                {patient.fullName || "Unnamed patient"}
              </h1>
              <span className="px-2 py-0.5 text-[11px] rounded-full bg-indigo-100 text-indigo-700 tracking-wide">
                PATIENT
              </span>
            </div>
            <div className="text-sm opacity-70">{patient.email}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              void loadPatient();
              void loadBookedAppts();
              void loadNotes(isDoctor);
            }}
            className="px-3 py-1.5 rounded-lg border text-sm hover:bg-gray-50"
            title="Refresh"
          >
            Refresh
          </button>

          {!isEditingProfile ? (
            <button
              type="button"
              onClick={() => {
                setProfileError(null);
                setIsEditingProfile(true);
              }}
              className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
            >
              Edit
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={cancelEditProfile}
                disabled={profileSaving}
                className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveProfile}
                disabled={profileSaving}
                className="rounded-xl bg-black text-white px-4 py-2 text-sm disabled:opacity-60"
              >
                {profileSaving ? "Saving..." : "Save"}
              </button>
            </>
          )}

          <a
            href={`mailto:${patient.email}`}
            className="px-3 py-1.5 rounded-lg border text-sm hover:bg-gray-50 inline-flex items-center gap-2"
            title="Email"
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-100 text-sky-600">
              ✉️
            </span>
            <span>Email</span>
          </a>

          <a
            href={patient.phone ? `tel:${patient.phone}` : undefined}
            className="px-3 py-1.5 rounded-lg border text-sm hover:bg-gray-50 inline-flex items-center gap-2"
            title="Call"
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              📞
            </span>
            <span>Call</span>
          </a>
        </div>
      </div>

      <div className="flex gap-2 border-b border-[var(--border)] pb-2 text-sm">
        <button
          className={`px-3 py-1.5 rounded-full ${
            tab === "profile"
              ? "bg-black text-white"
              : "bg-white hover:bg-black/5 border border-[var(--border)]"
          }`}
          onClick={() => setTab("profile")}
        >
          Personal details
        </button>
        {isDoctor && (
          <button
            className={`px-3 py-1.5 rounded-full ${
              tab === "notes"
                ? "bg-black text-white"
                : "bg-white hover:bg-black/5 border border-[var(--border)]"
            }`}
            onClick={() => setTab("notes")}
          >
            Doctor notes
          </button>
        )}
      </div>

      {tab === "profile" && (
        <>
          <div className="rounded-2xl ring-1 ring-[var(--border)] bg-white/70 p-5">
            <h2 className="text-base font-semibold mb-4">Personal details</h2>

            {profileError && (
              <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {profileError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-neutral-600">Full name</label>
                <input
                  className={profileInputCls}
                  value={form.fullName}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, fullName: e.target.value }))
                  }
                  disabled={!isEditingProfile}
                />
              </div>

              <div>
                <label className="text-sm text-neutral-600">Email</label>
                <input
                  type="email"
                  className={profileInputCls}
                  value={form.email}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, email: e.target.value }))
                  }
                  disabled={!isEditingProfile}
                />
              </div>

              <div>
                <label className="text-sm text-neutral-600">Date of birth</label>
                <input
                  type="date"
                  className={profileInputCls}
                  value={form.dob}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, dob: e.target.value }))
                  }
                  disabled={!isEditingProfile}
                />
              </div>

              <div>
                <label className="text-sm text-neutral-600">Age</label>
                <input
                  className="mt-1 w-full rounded-xl border px-3 py-2 bg-gray-50 text-gray-500"
                  value={profileAge !== null ? String(profileAge) : "—"}
                  disabled
                />
              </div>

              <div>
                <label className="text-sm text-neutral-600">Phone</label>
                <input
                  className={profileInputCls}
                  value={form.phone}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, phone: e.target.value }))
                  }
                  disabled={!isEditingProfile}
                />
              </div>

              <div>
                <label className="text-sm text-neutral-600">Sex</label>
                {isEditingProfile ? (
                  <select
                    className={profileInputCls}
                    value={form.sex}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        sex: e.target.value as PatientForm["sex"],
                      }))
                    }
                  >
                    <option value="">Select sex</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                ) : (
                  <input
                    className={profileInputCls}
                    value={sexLabel}
                    disabled
                  />
                )}
              </div>

              <div className="md:col-span-2">
                <label className="text-sm text-neutral-600">Address</label>
                <input
                  className={profileInputCls}
                  value={form.address}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, address: e.target.value }))
                  }
                  disabled={!isEditingProfile}
                />
              </div>

              {isEditingProfile && (
                <div className="md:col-span-2">
                  <label className="text-sm text-neutral-600">
                    New password
                  </label>
                  <input
                    type="password"
                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm bg-white"
                    value={form.password}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, password: e.target.value }))
                    }
                    placeholder="Leave blank to keep the current password"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl ring-1 ring-[var(--border)] bg-white/70 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold">Appointments</h2>
              <span className="px-3 py-1 rounded-full text-xs bg-black text-white">
                Booked
              </span>
            </div>

            {loadingAppts ? (
              <div className="text-sm opacity-70">Loading appointments…</div>
            ) : appts.length === 0 ? (
              <div className="text-sm opacity-70">No booked appointments.</div>
            ) : (
              <div className="overflow-hidden rounded-xl ring-1 ring-[var(--border)]">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-neutral-600">
                    <tr>
                      <th className="text-left px-4 py-2">Date &amp; time</th>
                      <th className="text-left px-4 py-2">Status</th>
                      <th className="text-left px-4 py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {appts.map((a) => {
                      const dtLabel = a.date
                        ? new Date(a.date).toLocaleString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : `${a.day} — ${a.time}`;

                      const s = (a.status ?? "booked").toLowerCase();
                      const pill =
                        s === "booked"
                          ? "bg-emerald-100 text-emerald-700"
                          : s === "done"
                          ? "bg-indigo-100 text-indigo-700"
                          : "bg-rose-100 text-rose-700";

                      return (
                        <tr key={a._id} className="border-t">
                          <td className="px-4 py-2">{dtLabel}</td>
                          <td className="px-4 py-2">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${pill}`}
                            >
                              {s}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            {a.notes && a.notes.trim() ? a.notes : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {typeof total === "number" && (
              <div className="mt-3 text-sm opacity-70">
                Showing {appts.length} of {total}
              </div>
            )}
          </div>
        </>
      )}

      {tab === "notes" && isDoctor && (
        <div className="rounded-2xl ring-1 ring-[var(--border)] bg-white/70 p-5 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold">Doctor notes</h2>
              <p className="text-xs text-muted">
                These notes are only visible to the doctors/staff, not to the patient.
              </p>
              {lastUpdated && (
                <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-2 py-0.5 text-[11px]">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  <span>
                    Last updated:{" "}
                    {new Date(lastUpdated).toLocaleString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={printDoctorNotes}
                className="px-3 py-1.5 rounded-xl border text-sm hover:bg-gray-50"
              >
                Print / PDF
              </button>

              {!isEditingNotes && (
                <button
                  onClick={() => setIsEditingNotes(true)}
                  className="px-3 py-1.5 rounded-xl text-sm text-white"
                  style={{ background: "#111" }}
                >
                  Edit notes
                </button>
              )}

              {isEditingNotes && (
                <>
                  <button
                    onClick={cancelEditNotes}
                    className="px-3 py-1.5 rounded-xl border text-sm hover:bg-gray-50"
                    disabled={notesSaving}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveNotes}
                    disabled={notesSaving}
                    className="px-3 py-1.5 rounded-xl text-sm text-white disabled:opacity-60"
                    style={{ background: "#111" }}
                  >
                    {notesSaving ? "Saving…" : "Save changes"}
                  </button>
                </>
              )}
            </div>
          </div>

          {notesLoading && (
            <div className="text-xs text-muted">Loading notes…</div>
          )}
          {notesError && (
            <div className="text-sm text-rose-600">{notesError}</div>
          )}

          <div className="mt-2 grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)] gap-4">
            <div className="space-y-4">
              <div>
                <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">
                  General assessment
                </div>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-neutral-600">
                      Pre-screening
                    </label>
                    <textarea
                      className={textAreaCls}
                      rows={3}
                      value={notesDraft?.preScreening || ""}
                      onChange={(e) =>
                        setNotesDraft((d) => ({
                          ...(d || {}),
                          preScreening: e.target.value,
                        }))
                      }
                      disabled={notesDisabled}
                    />
                  </div>

                  <div>
                    <label className="text-xs text-neutral-600">
                      Chief complaint
                    </label>
                    <textarea
                      className={textAreaCls}
                      rows={3}
                      value={notesDraft?.chiefComplaint || ""}
                      onChange={(e) =>
                        setNotesDraft((d) => ({
                          ...(d || {}),
                          chiefComplaint: e.target.value,
                        }))
                      }
                      disabled={notesDisabled}
                    />
                  </div>

                  <div>
                    <label className="text-xs text-neutral-600">Mono PD</label>
                    <input
                      className={textInputCls}
                      value={notesDraft?.monoPd || ""}
                      onChange={(e) =>
                        setNotesDraft((d) => ({
                          ...(d || {}),
                          monoPd: e.target.value,
                        }))
                      }
                      disabled={notesDisabled}
                    />
                  </div>

                  <div>
                    <label className="text-xs text-neutral-600">Bin PD</label>
                    <input
                      className={textInputCls}
                      value={notesDraft?.binPd || ""}
                      onChange={(e) =>
                        setNotesDraft((d) => ({
                          ...(d || {}),
                          binPd: e.target.value,
                        }))
                      }
                      disabled={notesDisabled}
                    />
                  </div>

                  <div>
                    <label className="text-xs text-neutral-600">
                      Present correction &amp; VA
                    </label>
                    <textarea
                      className={textAreaCls}
                      rows={2}
                      value={notesDraft?.presentCorrectionVa || ""}
                      onChange={(e) =>
                        setNotesDraft((d) => ({
                          ...(d || {}),
                          presentCorrectionVa: e.target.value,
                        }))
                      }
                      disabled={notesDisabled}
                    />
                  </div>

                  <div>
                    <label className="text-xs text-neutral-600">
                      Visual requirement
                    </label>
                    <textarea
                      className={textAreaCls}
                      rows={2}
                      value={notesDraft?.visualRequirement || ""}
                      onChange={(e) =>
                        setNotesDraft((d) => ({
                          ...(d || {}),
                          visualRequirement: e.target.value,
                        }))
                      }
                      disabled={notesDisabled}
                    />
                  </div>

                  <div>
                    <label className="text-xs text-neutral-600">
                      Ocular history
                    </label>
                    <textarea
                      className={textAreaCls}
                      rows={2}
                      value={notesDraft?.ocularHistory || ""}
                      onChange={(e) =>
                        setNotesDraft((d) => ({
                          ...(d || {}),
                          ocularHistory: e.target.value,
                        }))
                      }
                      disabled={notesDisabled}
                    />
                  </div>

                  <div>
                    <label className="text-xs text-neutral-600">
                      Lens type / age / condition
                    </label>
                    <textarea
                      className={textAreaCls}
                      rows={2}
                      value={notesDraft?.lensTypeAgeCondition || ""}
                      onChange={(e) =>
                        setNotesDraft((d) => ({
                          ...(d || {}),
                          lensTypeAgeCondition: e.target.value,
                        }))
                      }
                      disabled={notesDisabled}
                    />
                  </div>

                  <div>
                    <label className="text-xs text-neutral-600">
                      Plan &amp; management
                    </label>
                    <textarea
                      className={textAreaCls}
                      rows={3}
                      value={notesDraft?.planManagement || ""}
                      onChange={(e) =>
                        setNotesDraft((d) => ({
                          ...(d || {}),
                          planManagement: e.target.value,
                        }))
                      }
                      disabled={notesDisabled}
                    />
                  </div>

                  <div>
                    <label className="text-xs text-neutral-600">
                      Quality check
                    </label>
                    <textarea
                      className={textAreaCls}
                      rows={3}
                      value={notesDraft?.qualityCheck || ""}
                      onChange={(e) =>
                        setNotesDraft((d) => ({
                          ...(d || {}),
                          qualityCheck: e.target.value,
                        }))
                      }
                      disabled={notesDisabled}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">
                Visual acuity (VA)
              </div>
              <div className="mt-2 space-y-3">
                <EyeBlock
                  label="OD"
                  va={notesDraft?.odVa || ""}
                  comment={notesDraft?.odVaComment || ""}
                  onChangeVa={(v) =>
                    setNotesDraft((d) => ({ ...(d || {}), odVa: v }))
                  }
                  onChangeComment={(v) =>
                    setNotesDraft((d) => ({ ...(d || {}), odVaComment: v }))
                  }
                  disabled={notesDisabled}
                />
                <EyeBlock
                  label="OS"
                  va={notesDraft?.osVa || ""}
                  comment={notesDraft?.osVaComment || ""}
                  onChangeVa={(v) =>
                    setNotesDraft((d) => ({ ...(d || {}), osVa: v }))
                  }
                  onChangeComment={(v) =>
                    setNotesDraft((d) => ({ ...(d || {}), osVaComment: v }))
                  }
                  disabled={notesDisabled}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "notes" && !isDoctor && (
        <div className="rounded-2xl ring-1 ring-[var(--border)] bg-white/70 p-5 text-sm text-muted">
          Doctor notes are only visible to doctors.
        </div>
      )}
    </div>
  );
}