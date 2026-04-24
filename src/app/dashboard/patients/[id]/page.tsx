/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/dashboard/patients/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
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

type DoctorNoteHistoryItem = {
  id: string;
  title: string;
  description: string;
  doctorName: string;
  patientName: string;
  changedFields: string[];
  notesSnapshot?: DoctorNotes | null;
  previousNotesSnapshot?: DoctorNotes | null;
  createdAt: string;
};

type NotesPayload = {
  ok: boolean;
  notes?: DoctorNotes | null;
  lastUpdated?: string | null;
  error?: string;
};

type NotesHistoryPayload = {
  ok: boolean;
  items?: DoctorNoteHistoryItem[];
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

type Tab = "profile" | "notes";
type NotesView = "current" | "history";

const NOTE_FIELDS: Array<{
  key: keyof DoctorNotes;
  label: string;
  section: "General Assessment" | "Visual Acuity" | "Plan";
}> = [
  { key: "preScreening", label: "Pre-screening", section: "General Assessment" },
  { key: "chiefComplaint", label: "Chief complaint", section: "General Assessment" },
  { key: "monoPd", label: "Mono PD", section: "General Assessment" },
  { key: "binPd", label: "Bin PD", section: "General Assessment" },
  {
    key: "presentCorrectionVa",
    label: "Present correction & VA",
    section: "General Assessment",
  },
  {
    key: "visualRequirement",
    label: "Visual requirement",
    section: "General Assessment",
  },
  { key: "ocularHistory", label: "Ocular history", section: "General Assessment" },
  {
    key: "lensTypeAgeCondition",
    label: "Lens type / age / condition",
    section: "General Assessment",
  },
  { key: "odVa", label: "OD VA", section: "Visual Acuity" },
  { key: "odVaComment", label: "OD comment", section: "Visual Acuity" },
  { key: "osVa", label: "OS VA", section: "Visual Acuity" },
  { key: "osVaComment", label: "OS comment", section: "Visual Acuity" },
  { key: "planManagement", label: "Plan & management", section: "Plan" },
  { key: "qualityCheck", label: "Quality check", section: "Plan" },
];

const GENERAL_FIELDS: Array<{
  key: keyof DoctorNotes;
  label: string;
  rows: number;
  kind: "input" | "textarea";
}> = [
  { key: "preScreening", label: "Pre-screening", rows: 3, kind: "textarea" },
  { key: "chiefComplaint", label: "Chief complaint", rows: 3, kind: "textarea" },
  { key: "monoPd", label: "Mono PD", rows: 1, kind: "input" },
  { key: "binPd", label: "Bin PD", rows: 1, kind: "input" },
  {
    key: "presentCorrectionVa",
    label: "Present correction & VA",
    rows: 2,
    kind: "textarea",
  },
  {
    key: "visualRequirement",
    label: "Visual requirement",
    rows: 2,
    kind: "textarea",
  },
  { key: "ocularHistory", label: "Ocular history", rows: 2, kind: "textarea" },
  {
    key: "lensTypeAgeCondition",
    label: "Lens type / age / condition",
    rows: 2,
    kind: "textarea",
  },
  { key: "planManagement", label: "Plan & management", rows: 3, kind: "textarea" },
  { key: "qualityCheck", label: "Quality check", rows: 3, kind: "textarea" },
];

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

function formatDateTime(date?: string | null) {
  if (!date) return "—";

  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "—";

  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getNoteValue(notes: DoctorNotes | null | undefined, key: keyof DoctorNotes) {
  return notes?.[key]?.trim() || "—";
}

function getHistorySummary(item: DoctorNoteHistoryItem) {
  const n = item.notesSnapshot || {};

  return (
    n.chiefComplaint?.trim() ||
    n.planManagement?.trim() ||
    n.preScreening?.trim() ||
    item.description ||
    "Doctor note update"
  );
}

function isEmptyNotes(notes?: DoctorNotes | null) {
  if (!notes) return true;
  return NOTE_FIELDS.every((field) => !notes[field.key]?.trim());
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
    "mt-1 w-full rounded-2xl border border-neutral-200 px-3 py-2 text-sm outline-none transition " +
    (disabled
      ? "bg-neutral-50 text-neutral-500 cursor-default"
      : "bg-white focus:border-lime-400 focus:ring-4 focus:ring-lime-100");

  const textareaCls =
    "mt-1 w-full rounded-2xl border border-neutral-200 px-3 py-2 text-sm outline-none transition resize-none " +
    (disabled
      ? "bg-neutral-50 text-neutral-500 cursor-default"
      : "bg-white focus:border-lime-400 focus:ring-4 focus:ring-lime-100");

  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-lime-100 text-xs font-bold text-lime-700">
          {label}
        </span>

        <div>
          <div className="text-sm font-semibold text-neutral-900">{label} Eye</div>
          <div className="text-xs text-neutral-500">Visual acuity details</div>
        </div>
      </div>

      <label className="text-xs font-medium text-neutral-600">VA</label>
      <input
        className={inputCls}
        value={va}
        onChange={(e) => onChangeVa(e.target.value)}
        placeholder="e.g. 20/20"
        disabled={disabled}
      />

      <label className="mt-3 block text-xs font-medium text-neutral-600">
        Comment
      </label>
      <textarea
        className={textareaCls}
        rows={3}
        value={comment}
        onChange={(e) => onChangeComment(e.target.value)}
        placeholder="Notes about this eye..."
        disabled={disabled}
      />
    </div>
  );
}

function HistoryDetailsModal({
  item,
  onClose,
}: {
  item: DoctorNoteHistoryItem;
  onClose: () => void;
}) {
  const notes = item.notesSnapshot || null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-neutral-100 p-5">
          <div>
            <div className="mb-2 inline-flex rounded-full bg-lime-100 px-3 py-1 text-xs font-semibold text-lime-700">
              Saved note history
            </div>

            <h3 className="text-lg font-semibold text-neutral-950">
              {formatDateTime(item.createdAt)}
            </h3>

            <p className="mt-1 text-sm text-neutral-500">
              Saved by {item.doctorName || "Doctor"}
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-full border border-neutral-200 px-3 py-1.5 text-sm hover:bg-neutral-50"
          >
            Close
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-5">
          {!notes || isEmptyNotes(notes) ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              This older history record has no full note snapshot saved. New saved
              notes will show complete details here.
            </div>
          ) : (
            <div className="space-y-6">
              {["General Assessment", "Visual Acuity", "Plan"].map((section) => (
                <div key={section}>
                  <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-neutral-500">
                    {section}
                  </h4>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {NOTE_FIELDS.filter((field) => field.section === section).map(
                      (field) => (
                        <div
                          key={field.key}
                          className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3"
                        >
                          <div className="text-xs font-medium text-neutral-500">
                            {field.label}
                          </div>

                          <div className="mt-1 whitespace-pre-wrap text-sm text-neutral-900">
                            {getNoteValue(notes, field.key)}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PatientProfilePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const { role } = useAuth();

  const isDoctor = role === "doctor";

  // Doctor cannot edit personal details.
  // Staff/admin/other clinic-side roles can still use the old Edit button.
  const canEditProfile = Boolean(role && role !== "doctor" && role !== "patient");

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

  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [notesHistory, setNotesHistory] = useState<DoctorNoteHistoryItem[]>([]);
  const [selectedHistory, setSelectedHistory] =
    useState<DoctorNoteHistoryItem | null>(null);

  const [tab, setTab] = useState<Tab>("profile");
  const [notesView, setNotesView] = useState<NotesView>("current");

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

  const profileAge = computeAgeFromDob(form.dob);

  const sexLabel =
    patient?.sex === "male"
      ? "Male"
      : patient?.sex === "female"
      ? "Female"
      : patient?.sex === "other"
        ? "Other"
        : patient?.sex === "prefer_not_to_say"
          ? "Prefer not to say"
          : "—";

  const notesDisabled = !isEditingNotes;
  const profileDisabled = !canEditProfile || !isEditingProfile;

  const notesEmpty = useMemo(() => isEmptyNotes(notesDraft), [notesDraft]);

  const textInputCls =
    "mt-1 w-full rounded-2xl border border-neutral-200 px-3 py-2 text-sm outline-none transition " +
    (notesDisabled
      ? "bg-neutral-50 text-neutral-500 cursor-default"
      : "bg-white focus:border-lime-400 focus:ring-4 focus:ring-lime-100");

  const textAreaCls =
    "mt-1 w-full rounded-2xl border border-neutral-200 px-3 py-2 text-sm outline-none transition resize-none " +
    (notesDisabled
      ? "bg-neutral-50 text-neutral-500 cursor-default"
      : "bg-white focus:border-lime-400 focus:ring-4 focus:ring-lime-100");

  const profileInputCls =
    "mt-1 w-full rounded-2xl border border-neutral-200 px-3 py-2 text-sm outline-none transition " +
    (canEditProfile && isEditingProfile
      ? "bg-white focus:border-lime-400 focus:ring-4 focus:ring-lime-100"
      : "bg-neutral-50 text-neutral-500 cursor-default");

  function updateNote(key: keyof DoctorNotes, value: string) {
    setNotesDraft((prev) => ({ ...(prev || {}), [key]: value }));
  }

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
      const qs = new URLSearchParams({
        scope: "booked",
        page: "1",
        limit: "10",
      });

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

  async function loadNotesHistory(allow: boolean) {
    if (!id || !allow) {
      setNotesHistory([]);
      setHistoryLoading(false);
      return;
    }

    setHistoryLoading(true);
    setHistoryError(null);

    try {
      const res = await fetch(`/api/patients/${id}/doctor-notes/history`, {
        cache: "no-store",
      });

      const j: NotesHistoryPayload = await res.json();

      if (!res.ok || !j.ok) {
        throw new Error(j.error || `Failed (${res.status})`);
      }

      setNotesHistory(j.items || []);
    } catch (e: any) {
      setHistoryError(e.message || "Failed to load note history");
      setNotesHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function refreshAll() {
    await Promise.all([
      loadPatient(),
      loadBookedAppts(),
      loadNotes(isDoctor),
      loadNotesHistory(isDoctor),
    ]);
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

      await loadNotesHistory(isDoctor);
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
    if (!id || !canEditProfile) return;

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
          h1 { font-size: 22px; margin-bottom: 4px; }
          h2 { font-size: 16px; margin-top: 20px; margin-bottom: 8px; }
          .meta { font-size: 12px; color: #6b7280; margin-bottom: 16px; }
          .section { margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; margin-top: 4px; }
          th, td { border: 1px solid #e5e7eb; padding: 7px 8px; text-align: left; vertical-align: top; }
          th { background: #f3f4f6; width: 35%; }
        </style>
      </head>

      <body>
        <h1>Doctor Notes</h1>

        <div class="meta">
          Patient: ${safe(patient.fullName)} (${safe(patient.email || "No email")})<br/>
          Last updated: ${safe(formatDateTime(lastUpdated))}<br/>
          Generated: ${new Date().toLocaleString()}
        </div>

        <div class="section">
          <h2>General Assessment</h2>
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
          <h2>Visual Acuity</h2>
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
          <h2>Plan, Management &amp; Quality Check</h2>
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
    void loadNotesHistory(isDoctor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isDoctor]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-medium">Loading patient...</h1>
        </div>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="p-6">
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
          {error ?? "Patient not found"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {selectedHistory && (
        <HistoryDetailsModal
          item={selectedHistory}
          onClose={() => setSelectedHistory(null)}
        />
      )}

      <div className="rounded-[2rem] border border-neutral-200 bg-white/80 p-5 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-lime-100 text-lg font-bold text-lime-700">
              {patient.fullName?.[0]?.toUpperCase() ?? "U"}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold text-neutral-950">
                  {patient.fullName || "Unnamed patient"}
                </h1>

                <span className="rounded-full bg-lime-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-lime-700">
                  Patient
                </span>
              </div>

              <div className="mt-1 text-sm text-neutral-500">
                {patient.email || "No email recorded"}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={refreshAll}
              className="rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-50"
            >
              Refresh
            </button>

            {canEditProfile && (
              <>
                {!isEditingProfile ? (
                  <button
                    type="button"
                    onClick={() => {
                      setProfileError(null);
                      setIsEditingProfile(true);
                    }}
                    className="rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-50"
                  >
                    Edit
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={cancelEditProfile}
                      disabled={profileSaving}
                      className="rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-60"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={saveProfile}
                      disabled={profileSaving}
                      className="rounded-2xl bg-neutral-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                    >
                      {profileSaving ? "Saving..." : "Save"}
                    </button>
                  </>
                )}
              </>
            )}

            {patient.email ? (
              <a
                href={`mailto:${patient.email}`}
                className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-50"
              >
                <span>✉️</span>
                Email
              </a>
            ) : (
              <button
                disabled
                className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm font-medium text-neutral-400"
              >
                <span>✉️</span>
                No email
              </button>
            )}

            {patient.phone ? (
              <a
                href={`tel:${patient.phone}`}
                className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-50"
              >
                <span>📞</span>
                Call
              </a>
            ) : (
              <button
                disabled
                className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm font-medium text-neutral-400"
              >
                <span>📞</span>
                No phone
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-2 border-b border-neutral-200 pb-3 text-sm">
        <button
          className={`rounded-full px-4 py-2 font-medium transition ${
            tab === "profile"
              ? "bg-neutral-950 text-white"
              : "bg-white text-neutral-700 hover:bg-neutral-100"
          }`}
          onClick={() => setTab("profile")}
        >
          Personal details
        </button>

        {isDoctor && (
          <button
            className={`rounded-full px-4 py-2 font-medium transition ${
              tab === "notes"
                ? "bg-neutral-950 text-white"
                : "bg-white text-neutral-700 hover:bg-neutral-100"
            }`}
            onClick={() => setTab("notes")}
          >
            Doctor notes
          </button>
        )}
      </div>

      {tab === "profile" && (
        <>
          <div className="rounded-[2rem] border border-neutral-200 bg-white/80 p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-neutral-950">
                  Personal details
                </h2>

                {!canEditProfile && isDoctor && (
                  <p className="mt-1 text-xs text-neutral-500">
                    View-only for doctors. Patient personal details can only be
                    updated by authorized staff/admin.
                  </p>
                )}
              </div>

              {!canEditProfile && isDoctor && (
                <span className="w-fit rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">
                  View only
                </span>
              )}
            </div>

            {profileError && (
              <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {profileError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-neutral-600">
                  Full name
                </label>
                <input
                  className={profileInputCls}
                  value={form.fullName}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, fullName: e.target.value }))
                  }
                  disabled={profileDisabled}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-neutral-600">
                  Email
                </label>
                <input
                  type="email"
                  className={profileInputCls}
                  value={form.email}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, email: e.target.value }))
                  }
                  disabled={profileDisabled}
                  placeholder="Optional"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-neutral-600">
                  Date of birth
                </label>
                <input
                  type="date"
                  className={profileInputCls}
                  value={form.dob}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, dob: e.target.value }))
                  }
                  disabled={profileDisabled}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-neutral-600">
                  Age
                </label>
                <input
                  className="mt-1 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500"
                  value={profileAge !== null ? String(profileAge) : "—"}
                  disabled
                />
              </div>

              <div>
                <label className="text-sm font-medium text-neutral-600">
                  Phone
                </label>
                <input
                  className={profileInputCls}
                  value={form.phone}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, phone: e.target.value }))
                  }
                  disabled={profileDisabled}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-neutral-600">
                  Sex
                </label>

                {canEditProfile && isEditingProfile ? (
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
                  <input className={profileInputCls} value={sexLabel} disabled />
                )}
              </div>

              <div className="md:col-span-2">
                <label className="text-sm font-medium text-neutral-600">
                  Address
                </label>
                <input
                  className={profileInputCls}
                  value={form.address}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, address: e.target.value }))
                  }
                  disabled={profileDisabled}
                />
              </div>

              {canEditProfile && isEditingProfile && (
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-neutral-600">
                    New password
                  </label>
                  <input
                    type="password"
                    className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-lime-400 focus:ring-4 focus:ring-lime-100"
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

          <div className="rounded-[2rem] border border-neutral-200 bg-white/80 p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-neutral-950">
                Appointments
              </h2>

              <span className="rounded-full bg-lime-100 px-3 py-1 text-xs font-bold text-lime-700">
                Booked
              </span>
            </div>

            {loadingAppts ? (
              <div className="text-sm text-neutral-500">
                Loading appointments...
              </div>
            ) : appts.length === 0 ? (
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500">
                No booked appointments.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-neutral-200">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 text-neutral-600">
                    <tr>
                      <th className="px-4 py-3 text-left">Date & time</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Notes</th>
                    </tr>
                  </thead>

                  <tbody className="bg-white">
                    {appts.map((a) => {
                      const dtLabel = a.date
                        ? formatDateTime(a.date)
                        : `${a.day} — ${a.time}`;

                      const s = (a.status ?? "booked").toLowerCase();

                      const pill =
                        s === "booked"
                          ? "bg-emerald-100 text-emerald-700"
                          : s === "done"
                            ? "bg-indigo-100 text-indigo-700"
                            : "bg-rose-100 text-rose-700";

                      return (
                        <tr key={a._id} className="border-t border-neutral-100">
                          <td className="px-4 py-3">{dtLabel}</td>

                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${pill}`}
                            >
                              {s}
                            </span>
                          </td>

                          <td className="px-4 py-3">
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
              <div className="mt-3 text-sm text-neutral-500">
                Showing {appts.length} of {total}
              </div>
            )}
          </div>
        </>
      )}

      {tab === "notes" && isDoctor && (
        <div className="rounded-[2rem] border border-neutral-200 bg-white/80 p-5 shadow-sm">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-neutral-950">
                Doctor notes
              </h2>

              <p className="mt-1 text-sm text-neutral-500">
                These notes are only visible to the doctors/staff, not to the patient.
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {lastUpdated && (
                  <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    Last updated: {formatDateTime(lastUpdated)}
                  </div>
                )}

                <div className="inline-flex items-center gap-2 rounded-full bg-lime-50 px-3 py-1 text-xs font-medium text-lime-700">
                  <span className="h-2 w-2 rounded-full bg-lime-500" />
                  {notesHistory.length} saved history record
                  {notesHistory.length === 1 ? "" : "s"}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={printDoctorNotes}
                className="rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-50"
              >
                Print / PDF
              </button>

              {!isEditingNotes && notesView === "current" && (
                <button
                  onClick={() => setIsEditingNotes(true)}
                  className="rounded-2xl bg-neutral-950 px-4 py-2 text-sm font-medium text-white"
                >
                  Edit notes
                </button>
              )}

              {isEditingNotes && notesView === "current" && (
                <>
                  <button
                    onClick={cancelEditNotes}
                    className="rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-60"
                    disabled={notesSaving}
                  >
                    Cancel
                  </button>

                  <button
                    onClick={saveNotes}
                    disabled={notesSaving}
                    className="rounded-2xl bg-lime-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                  >
                    {notesSaving ? "Saving..." : "Save changes"}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="mb-5 inline-flex rounded-full border border-neutral-200 bg-neutral-50 p-1">
            <button
              onClick={() => setNotesView("current")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                notesView === "current"
                  ? "bg-white text-neutral-950 shadow-sm"
                  : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              Current note
            </button>

            <button
              onClick={() => setNotesView("history")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                notesView === "history"
                  ? "bg-white text-neutral-950 shadow-sm"
                  : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              History
            </button>
          </div>

          {notesError && (
            <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {notesError}
            </div>
          )}

          {notesView === "current" && (
            <>
              {notesLoading ? (
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500">
                  Loading notes...
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(340px,1fr)]">
                  <div className="space-y-5">
                    {notesEmpty && !isEditingNotes && (
                      <div className="rounded-3xl border border-lime-200 bg-lime-50 p-4 text-sm text-lime-800">
                        No doctor notes yet. Click <strong>Edit notes</strong> to
                        add the first record.
                      </div>
                    )}

                    <div>
                      <div className="mb-3 text-xs font-bold uppercase tracking-wide text-neutral-500">
                        General assessment
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {GENERAL_FIELDS.map((field) => (
                          <div key={field.key}>
                            <label className="text-xs font-medium text-neutral-600">
                              {field.label}
                            </label>

                            {field.kind === "input" ? (
                              <input
                                className={textInputCls}
                                value={notesDraft?.[field.key] || ""}
                                onChange={(e) =>
                                  updateNote(field.key, e.target.value)
                                }
                                disabled={notesDisabled}
                              />
                            ) : (
                              <textarea
                                className={textAreaCls}
                                rows={field.rows}
                                value={notesDraft?.[field.key] || ""}
                                onChange={(e) =>
                                  updateNote(field.key, e.target.value)
                                }
                                disabled={notesDisabled}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="mb-3 text-xs font-bold uppercase tracking-wide text-neutral-500">
                      Visual acuity
                    </div>

                    <div className="space-y-3">
                      <EyeBlock
                        label="OD"
                        va={notesDraft?.odVa || ""}
                        comment={notesDraft?.odVaComment || ""}
                        onChangeVa={(v) => updateNote("odVa", v)}
                        onChangeComment={(v) => updateNote("odVaComment", v)}
                        disabled={notesDisabled}
                      />

                      <EyeBlock
                        label="OS"
                        va={notesDraft?.osVa || ""}
                        comment={notesDraft?.osVaComment || ""}
                        onChangeVa={(v) => updateNote("osVa", v)}
                        onChangeComment={(v) => updateNote("osVaComment", v)}
                        disabled={notesDisabled}
                      />

                      <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-4 text-xs text-neutral-500">
                        Tip: Every time you save changes, a dated copy is added
                        to the patient’s note history.
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {notesView === "history" && (
            <div>
              {historyError && (
                <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {historyError}
                </div>
              )}

              {historyLoading ? (
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500">
                  Loading note history...
                </div>
              ) : notesHistory.length === 0 ? (
                <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-6 text-center">
                  <div className="text-3xl">📝</div>

                  <h3 className="mt-2 font-semibold text-neutral-900">
                    No saved history yet
                  </h3>

                  <p className="mt-1 text-sm text-neutral-500">
                    Once the doctor saves notes, previous versions will appear
                    here with date, time, and doctor name.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notesHistory.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-lime-300 hover:shadow-md"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-neutral-950">
                              {formatDateTime(item.createdAt)}
                            </h3>

                            <span className="rounded-full bg-lime-100 px-2 py-0.5 text-[11px] font-bold text-lime-700">
                              Saved
                            </span>
                          </div>

                          <p className="mt-1 text-sm text-neutral-500">
                            Saved by {item.doctorName || "Doctor"}
                          </p>

                          <p className="mt-3 line-clamp-2 text-sm text-neutral-800">
                            {getHistorySummary(item)}
                          </p>

                          {item.changedFields?.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {item.changedFields.slice(0, 5).map((field) => (
                                <span
                                  key={field}
                                  className="rounded-full bg-neutral-100 px-2 py-1 text-[11px] font-medium text-neutral-600"
                                >
                                  {field}
                                </span>
                              ))}

                              {item.changedFields.length > 5 && (
                                <span className="rounded-full bg-neutral-100 px-2 py-1 text-[11px] font-medium text-neutral-600">
                                  +{item.changedFields.length - 5} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => setSelectedHistory(item)}
                          className="shrink-0 rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-50"
                        >
                          View full note
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "notes" && !isDoctor && (
        <div className="rounded-[2rem] border border-neutral-200 bg-white/80 p-5 text-sm text-neutral-500 shadow-sm">
          Doctor notes are only visible to doctors.
        </div>
      )}
    </div>
  );
}