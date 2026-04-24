// src/app/dashboard/patients/page.tsx
"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import Guard from "@/components/auth/Guard";
import { ageFromDob } from "@/lib/age";

type Row = {
  _id: string;
  email?: string | null;
  role: "patient";
  profile?: {
    fullName?: string | null;
    phone?: string | null;
    dob?: string | null;
    address?: string | null;
  };
  lastVisit?: string | null;
};

type SortKey = "name" | "email" | "age" | "lastVisit";
type SortDir = "asc" | "desc";

type PatientFormState = {
  fullName: string;
  email: string;
  phone: string;
  dob: string;
  address: string;
};

const EMPTY_FORM: PatientFormState = {
  fullName: "",
  email: "",
  phone: "",
  dob: "",
  address: "",
};

export default function PatientsListPage() {
  return (
    <Guard requireAuth roles={["doctor", "admin", "assistant"]}>
      <PatientsListInner />
    </Guard>
  );
}

function PatientsListInner() {
  const { data: session, status } = useSession();

  const isDoctor =
    status === "authenticated" && (session as any)?.user?.role === "doctor";

  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [page, setPage] = useState(1);
  const pageSize = 6;

  const [needle, setNeedle] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [showAddModal, setShowAddModal] = useState(false);
  const [patientToDelete, setPatientToDelete] = useState<Row | null>(null);

  const [form, setForm] = useState<PatientFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setNeedle(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let cancelled = false;

    async function loadPatients() {
      setLoading(true);
      setErr(null);

      try {
        const url =
          "/api/patients" + (needle ? `?q=${encodeURIComponent(needle)}` : "");

        const r = await fetch(url, { cache: "no-store" });

        if (!r.ok) {
          throw new Error("Failed");
        }

        const data = await r.json();

        if (!cancelled) {
          setRows(data.items || []);
          setPage(1);
        }
      } catch {
        if (!cancelled) {
          setErr("Could not load patients.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadPatients();

    return () => {
      cancelled = true;
    };
  }, [needle, refreshKey]);

  const { total, avgAge } = useMemo(() => {
    const ages = rows
      .map((r) => ageFromDob(r.profile?.dob))
      .filter((a): a is number => typeof a === "number");

    const avg = ages.length
      ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length)
      : null;

    return { total: rows.length, avgAge: avg };
  }, [rows]);

  const sorted = useMemo(() => {
    const base = [...rows];

    base.sort((a, b) => {
      const aName = (a.profile?.fullName || "").toLowerCase();
      const bName = (b.profile?.fullName || "").toLowerCase();

      const aAge = ageFromDob(a.profile?.dob) ?? -1;
      const bAge = ageFromDob(b.profile?.dob) ?? -1;

      const aEmail = (a.email || "").toLowerCase();
      const bEmail = (b.email || "").toLowerCase();

      const aLast = a.lastVisit ? Date.parse(a.lastVisit) || 0 : 0;
      const bLast = b.lastVisit ? Date.parse(b.lastVisit) || 0 : 0;

      let cmp = 0;

      if (sortKey === "name") cmp = aName.localeCompare(bName);
      if (sortKey === "email") cmp = aEmail.localeCompare(bEmail);
      if (sortKey === "age") cmp = aAge - bAge;
      if (sortKey === "lastVisit") cmp = aLast - bLast;

      return sortDir === "asc" ? cmp : -cmp;
    });

    return base;
  }, [rows, sortKey, sortDir]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const disabledPrev = page <= 1;
  const disabledNext = page >= pageCount;

  function refreshPatients() {
    setRefreshKey((v) => v + 1);
  }

  function openAddModal() {
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowAddModal(true);
  }

  function closeModals() {
    setShowAddModal(false);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormBusy(false);
  }

  async function handleAddPatient(e: FormEvent) {
    e.preventDefault();

    setFormBusy(true);
    setFormError(null);

    try {
      const payload = {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        dob: form.dob.trim(),
        address: form.address.trim(),
      };

      const r = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await r.json().catch(() => ({}));

      if (!r.ok) {
        throw new Error(data?.error || "Failed to add patient.");
      }

      closeModals();
      refreshPatients();
    } catch (error: any) {
      setFormError(error?.message || "Failed to add patient.");
      setFormBusy(false);
    }
  }

  async function handleDeletePatient() {
    if (!patientToDelete?._id) return;

    setDeleteBusy(true);

    try {
      const r = await fetch(`/api/patients/${patientToDelete._id}`, {
        method: "DELETE",
      });

      const data = await r.json().catch(() => ({}));

      if (!r.ok) {
        throw new Error(data?.error || "Failed to delete patient.");
      }

      setPatientToDelete(null);
      setDeleteBusy(false);
      refreshPatients();
    } catch (error: any) {
      setErr(error?.message || "Failed to delete patient.");
      setDeleteBusy(false);
    }
  }

  return (
    <>
      <div className="w-full min-w-0 space-y-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold tracking-tight">Patients</h1>
            <p className="text-sm text-muted">
              Browse your patient list, see their last check-ups, and open a
              complete record.
            </p>
          </div>

          <div className="w-full xl:w-auto xl:max-w-[420px] flex flex-col gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <StatCard label="Total patients" value={total.toString()} />
              <StatCard
                label="Average age"
                value={avgAge == null ? "—" : `${avgAge} yrs`}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              <button
                onClick={openAddModal}
                className="text-xs md:text-sm rounded-full border px-3 py-1.5 bg-[var(--primary)]/15 hover:bg-[var(--primary)]/22 transition"
              >
                + Add patient
              </button>

              {isDoctor && (
                <Link
                  href="/dashboard/patients/prescription-requests"
                  className="text-xs md:text-sm rounded-full border px-3 py-1.5 bg-white/90 hover:bg-black/5 transition"
                >
                  View prescription requests
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <input
            value={q}
            onChange={(e) => setQ(e.currentTarget.value)}
            placeholder="Search name, email, phone…"
            className="w-full lg:max-w-md rounded-xl px-3 py-2 ring-1 ring-[var(--border)] bg-white/95 outline-none focus:ring-[var(--primary)]"
          />

          <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
            <Dropdown
              label={`Sort: ${labelFor(sortKey)}`}
              items={[
                { key: "name", label: "Name" },
                { key: "email", label: "Email" },
                { key: "age", label: "Age" },
                { key: "lastVisit", label: "Last check-up" },
              ]}
              onSelect={(k) => setSortKey(k as SortKey)}
            />

            <button
              onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
              className="h-9 px-3 rounded-xl ring-1 ring-[var(--border)] bg-white/95 text-sm"
              title="Toggle sort direction"
            >
              {sortDir === "asc" ? "↑ Asc" : "↓ Desc"}
            </button>
          </div>
        </div>

        <div className="w-full min-w-0">
          <div className="rounded-2xl overflow-hidden ring-1 ring-[var(--border)] bg-white/90 w-full">
            <div className="grid grid-cols-12 gap-4 px-4 py-2 text-[11px] font-semibold text-muted uppercase tracking-wide bg-black/[0.03]">
              <div className="col-span-4 min-w-0">Name</div>
              <div className="col-span-3 min-w-0">Email</div>
              <div className="col-span-2 min-w-0">Last check-up</div>
              <div className="col-span-1 min-w-0">Next check-up</div>
              <div className="col-span-1 text-right min-w-0">Age</div>
              <div className="col-span-1 text-right min-w-0">Actions</div>
            </div>

            {loading ? (
              <SkeletonList rows={6} />
            ) : err ? (
              <div className="px-4 py-10 text-sm" style={{ color: "#b10d0d" }}>
                {err}
              </div>
            ) : sorted.length === 0 ? (
              <EmptyState onAdd={openAddModal} />
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {paged.map((r, idx) => {
                  const name = r.profile?.fullName || "Unnamed patient";
                  const age = ageFromDob(r.profile?.dob);
                  const lastLabel = formatLastCheckup(r.lastVisit);
                  const nextLabel = formatNextCheckup(r.lastVisit);
                  const hasLast = !!r.lastVisit;

                  return (
                    <li
                      key={r._id}
                      className={[
                        "grid grid-cols-12 gap-4 px-4 py-3 hover:bg-black/[0.04] transition items-center",
                        idx % 2 === 1 ? "bg-black/[0.01]" : "",
                      ].join(" ")}
                    >
                      <Link
                        href={`/dashboard/patients/${r._id}`}
                        className="col-span-11 grid grid-cols-11 gap-4 items-center min-w-0"
                      >
                        <div className="col-span-4 min-w-0 flex items-center gap-3">
                          <Avatar label={name} />
                          <div className="min-w-0">
                            <div className="truncate font-medium">{name}</div>
                            <div className="text-[11px] text-muted truncate">
                              {r.profile?.phone
                                ? prettifyPhone(r.profile.phone)
                                : "No phone"}
                            </div>
                          </div>
                        </div>

                        <div className="col-span-3 min-w-0 truncate text-muted">
                          {r.email ? r.email : "No email"}
                        </div>

                        <div className="col-span-2 min-w-0 flex items-center">
                          {hasLast ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-100">
                              {lastLabel}
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted">
                              No record
                            </span>
                          )}
                        </div>

                        <div className="col-span-1 min-w-0 flex items-center">
                          {hasLast ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-100 whitespace-nowrap">
                              {nextLabel}
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted">—</span>
                          )}
                        </div>

                        <div className="col-span-1 text-right pr-2 min-w-0">
                          <span className="text-sm">{age ?? "—"}</span>
                        </div>
                      </Link>

                      <div className="col-span-1 flex justify-end pl-2 min-w-0">
                        <button
                          type="button"
                          onClick={() => {
                            setErr(null);
                            setDeleteBusy(false);
                            setPatientToDelete(r);
                          }}
                          className="rounded-lg px-2 py-1 text-[11px] ring-1 ring-red-200 bg-red-50 text-red-700 hover:bg-red-100 whitespace-nowrap"
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {!loading && sorted.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm">
            <div className="text-muted">
              Page {page} of {pageCount} • Showing {paged.length} of{" "}
              {sorted.length}
            </div>

            <div className="flex gap-2">
              <button
                className="h-9 px-3 rounded-xl ring-1 ring-[var(--border)] bg-white/95 disabled:opacity-50"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={disabledPrev}
              >
                Prev
              </button>

              <button
                className="h-9 px-3 rounded-xl ring-1 ring-[var(--border)] bg-white/95 disabled:opacity-50"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={disabledNext}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <PatientModal
        open={showAddModal}
        title="Add patient"
        submitLabel={formBusy ? "Saving..." : "Save patient"}
        form={form}
        setForm={setForm}
        error={formError}
        busy={formBusy}
        onClose={closeModals}
        onSubmit={handleAddPatient}
      />

      <ConfirmDeleteModal
        open={!!patientToDelete}
        patientName={
          patientToDelete?.profile?.fullName ||
          patientToDelete?.email ||
          "this patient"
        }
        busy={deleteBusy}
        onCancel={() => {
          setPatientToDelete(null);
          setDeleteBusy(false);
        }}
        onConfirm={handleDeletePatient}
      />
    </>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="w-full min-w-0 rounded-xl px-4 py-2 ring-1 ring-[var(--border)] bg-white/90">
      <div className="text-[11px] uppercase tracking-wide text-muted">
        {label}
      </div>
      <div className="text-lg font-semibold mt-0.5">{value}</div>
    </div>
  );
}

function Avatar({ label }: { label: string }) {
  const letter = (label || "?").slice(0, 1).toUpperCase();

  return (
    <div className="h-8 w-8 rounded-lg bg-[var(--primary)]/18 text-[var(--primary-ink,#2a2a2a)] flex items-center justify-center text-sm font-semibold shrink-0">
      {letter}
    </div>
  );
}

function Dropdown({
  label,
  items,
  onSelect,
}: {
  label: string;
  items: { key: string; label: string }[];
  onSelect: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="h-9 px-3 rounded-xl ring-1 ring-[var(--border)] bg-white/95 text-sm"
      >
        {label}
      </button>

      {open && (
        <div
          className="absolute right-0 z-10 mt-2 w-44 rounded-xl ring-1 ring-[var(--border)] bg-white/98 shadow-lg p-1"
          onMouseLeave={() => setOpen(false)}
        >
          {items.map((it) => (
            <button
              key={it.key}
              onClick={() => {
                onSelect(it.key);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-black/5 text-sm"
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SkeletonList({ rows = 6 }: { rows?: number }) {
  return (
    <ul className="animate-pulse divide-y divide-[var(--border)]">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="grid grid-cols-12 gap-4 px-4 py-3">
          <div className="col-span-4 flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-black/10 shrink-0" />
            <div className="h-3 w-40 rounded bg-black/10" />
          </div>

          <div className="col-span-3 min-w-0">
            <div className="h-3 w-full max-w-[220px] rounded bg-black/10" />
          </div>

          <div className="col-span-2 min-w-0">
            <div className="h-3 w-full max-w-[120px] rounded bg-black/10" />
          </div>

          <div className="col-span-1 min-w-0">
            <div className="h-3 w-full max-w-[70px] rounded bg-black/10" />
          </div>

          <div className="col-span-1 flex justify-end min-w-0">
            <div className="h-3 w-8 rounded bg-black/10" />
          </div>

          <div className="col-span-1 flex justify-end min-w-0">
            <div className="h-7 w-16 rounded bg-black/10" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="px-6 py-14 text-center">
      <div className="text-4xl mb-2">🩺</div>
      <div className="text-sm text-muted mb-4">
        No patients found. Try another search.
      </div>

      <button
        onClick={onAdd}
        className="rounded-xl px-4 py-2 ring-1 ring-[var(--border)] bg-white hover:bg-black/5 text-sm"
      >
        Add patient
      </button>
    </div>
  );
}

function PatientModal({
  open,
  title,
  submitLabel,
  form,
  setForm,
  error,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  submitLabel: string;
  form: PatientFormState;
  setForm: React.Dispatch<React.SetStateAction<PatientFormState>>;
  error: string | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl ring-1 ring-black/5">
        <form onSubmit={onSubmit}>
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold">{title}</h2>
              <p className="text-sm text-muted">
                Create a patient record. Email is optional and no password is
                needed for walk-in patient records.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-sm hover:bg-black/5"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-5 py-5">
            <Field label="Full name" required>
              <input
                value={form.fullName}
                onChange={(e) =>
                  setForm((s) => ({ ...s, fullName: e.target.value }))
                }
                className="w-full rounded-xl px-3 py-2 ring-1 ring-[var(--border)] bg-white outline-none focus:ring-[var(--primary)]"
                placeholder="Juan Dela Cruz"
                required
              />
            </Field>

            <Field label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((s) => ({ ...s, email: e.target.value }))
                }
                className="w-full rounded-xl px-3 py-2 ring-1 ring-[var(--border)] bg-white outline-none focus:ring-[var(--primary)]"
                placeholder="Optional"
              />
            </Field>

            <Field label="Phone">
              <input
                value={form.phone}
                onChange={(e) =>
                  setForm((s) => ({ ...s, phone: e.target.value }))
                }
                className="w-full rounded-xl px-3 py-2 ring-1 ring-[var(--border)] bg-white outline-none focus:ring-[var(--primary)]"
                placeholder="09XXXXXXXXX"
              />
            </Field>

            <Field label="Date of birth">
              <input
                type="date"
                value={form.dob}
                onChange={(e) =>
                  setForm((s) => ({ ...s, dob: e.target.value }))
                }
                className="w-full rounded-xl px-3 py-2 ring-1 ring-[var(--border)] bg-white outline-none focus:ring-[var(--primary)]"
              />
            </Field>

            <Field label="Address">
              <input
                value={form.address}
                onChange={(e) =>
                  setForm((s) => ({ ...s, address: e.target.value }))
                }
                className="w-full rounded-xl px-3 py-2 ring-1 ring-[var(--border)] bg-white outline-none focus:ring-[var(--primary)]"
                placeholder="City / full address"
              />
            </Field>
          </div>

          {error && (
            <div className="px-5 pb-1 text-sm text-red-700">{error}</div>
          )}

          <div className="flex items-center justify-end gap-2 border-t px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm ring-1 ring-[var(--border)] bg-white hover:bg-black/5"
              disabled={busy}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="rounded-xl px-4 py-2 text-sm bg-[var(--primary)]/20 hover:bg-[var(--primary)]/30 disabled:opacity-60"
              disabled={busy}
            >
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConfirmDeleteModal({
  open,
  patientName,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  patientName: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl ring-1 ring-black/5 p-5">
        <h2 className="text-lg font-semibold mb-2">Delete patient</h2>

        <p className="text-sm text-muted mb-5">
          Are you sure you want to delete{" "}
          <span className="font-medium text-black">{patientName}</span>? This
          action cannot be undone.
        </p>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl px-4 py-2 text-sm ring-1 ring-[var(--border)] bg-white hover:bg-black/5"
            disabled={busy}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl px-4 py-2 text-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
            disabled={busy}
          >
            {busy ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-sm font-medium">
        {label} {required && <span className="text-red-600">*</span>}
      </div>
      {children}
    </label>
  );
}

function labelFor(k: SortKey) {
  if (k === "name") return "Name";
  if (k === "email") return "Email";
  if (k === "age") return "Age";
  return "Last check-up";
}

function prettifyPhone(p?: string | null) {
  if (!p) return "";

  const d = p.replace(/\D/g, "");

  if (d.length === 11) {
    return `(+63) ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7, 11)}`;
  }

  if (d.length === 10) {
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)} ${d.slice(6, 10)}`;
  }

  return p;
}

function formatLastCheckup(iso?: string | null): string {
  if (!iso) return "—";

  const d = new Date(iso);

  if (Number.isNaN(d.getTime())) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

function formatNextCheckup(iso?: string | null): string {
  if (!iso) return "—";

  const d = new Date(iso);

  if (Number.isNaN(d.getTime())) return "—";

  const next = new Date(d.getTime());
  next.setMonth(next.getMonth() + 6);

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(next);
}