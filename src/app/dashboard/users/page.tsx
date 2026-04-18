/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import { ALL_ROLES, Role } from "@/lib/roles";
import Guard from "@/components/auth/Guard";
import { useAuth } from "@/components/auth/AuthContext";

type Row = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  created_at: string;
};

const PAGE_SIZE = 6;

// Roles allowed to be created by admin from the modal (staff + supplier)
const CREATE_ROLE_OPTIONS: Role[] = ["doctor", "assistant", "sales", "supplier", "admin"];

export default function AdminUsersPage() {
  const { user } = useAuth();
  const currentUserId = (user as any)?.id as string | undefined;
  const currentUserEmail = (user as any)?.email as string | undefined;

  const [rows, setRows] = useState<Row[]>([]);
  const [filtered, setFiltered] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  // Edit state (no more instant role change)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftRole, setDraftRole] = useState<Role | null>(null);

  // Confirm modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [reason, setReason] = useState("");
  const [confirmTarget, setConfirmTarget] = useState<{
    id: string;
    email: string;
    from: Role;
    to: Role;
  } | null>(null);

  // --- Create staff modal state ---
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createRole, setCreateRole] = useState<Role>("assistant");
  const [createMsg, setCreateMsg] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/users", { method: "GET" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Failed to load users (${res.status})`);
      }
      const data: Row[] = await res.json();
      setRows(data || []);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  // Search filter
  useEffect(() => {
    const term = q.trim().toLowerCase();
    if (!term) {
      setFiltered(rows);
      return;
    }
    setFiltered(
      rows.filter((r) =>
        [r.email, r.full_name ?? "", r.role]
          .join(" ")
          .toLowerCase()
          .includes(term)
      )
    );
  }, [q, rows]);

  // Current admin row (always pinned at top)
  const selfRow = useMemo(() => {
    return (
      rows.find(
        (r) =>
          (currentUserId && r.id === currentUserId) ||
          (currentUserEmail && r.email === currentUserEmail)
      ) ?? null
    );
  }, [rows, currentUserId, currentUserEmail]);

  // Adjust page when filtered list changes
  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil((filtered.length || 1) / PAGE_SIZE));
    if (page > maxPage) setPage(maxPage);
  }, [filtered, page]);

  function resetEdit() {
    setEditingId(null);
    setDraftRole(null);
  }

  function openConfirm(r: Row) {
    if (!draftRole || draftRole === r.role) {
      setErr("No changes to save.");
      return;
    }
    setErr(null);
    setConfirmText("");
    setReason("");
    setConfirmTarget({ id: r.id, email: r.email, from: r.role, to: draftRole });
    setConfirmOpen(true);
  }

  function closeConfirm() {
    setConfirmOpen(false);
    setConfirmTarget(null);
    setConfirmText("");
    setReason("");
  }

  async function submitRoleChange() {
    if (!confirmTarget) return;

    const typed = confirmText.trim().toUpperCase();
    if (typed !== "CHANGE") {
      setErr('Type "CHANGE" to confirm.');
      return;
    }
    if (!reason.trim() || reason.trim().length < 5) {
      setErr("Please provide a short reason (at least 5 characters).");
      return;
    }

    const { id, to } = confirmTarget;

    const prev = rows.slice();
    setBusy(true);
    setErr(null);

    // optimistic UI update
    setRows((list) => list.map((r) => (r.id === id ? { ...r, role: to } : r)));

    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, role: to, reason: reason.trim() }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Failed to update role (${res.status})`);
      }

      const updated: Row = await res.json();
      setRows((list) => list.map((r) => (r.id === id ? updated : r)));

      closeConfirm();
      resetEdit();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to update role");
      setRows(prev);
    } finally {
      setBusy(false);
    }
  }

  async function deleteUser(id: string, email: string) {
    const first = window.confirm(
      `Delete user account "${email}"? This cannot be undone.`
    );
    if (!first) return;
    const confirmText = window.prompt('Type "DELETE" to confirm:');
    if (confirmText !== "DELETE") return;

    setErr(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data.error || `Failed to delete user (${res.status})`);
      }
      setRows((list) => list.filter((r) => r.id !== id));
      if (editingId === id) resetEdit();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to delete user");
    }
  }

  // --- Create staff account ---
  function openCreate() {
    setCreateOpen(true);
    setCreateMsg(null);
    setErr(null);
    setCreateName("");
    setCreateEmail("");
    setCreateRole("assistant");
  }

  function closeCreate() {
    setCreateOpen(false);
    setCreateMsg(null);
  }

  async function submitCreate() {
    setErr(null);
    setCreateMsg(null);

    if (!createName.trim()) {
      setErr("Please enter a name.");
      return;
    }
    if (!createEmail.trim()) {
      setErr("Please enter an email.");
      return;
    }
    if (!CREATE_ROLE_OPTIONS.includes(createRole)) {
      setErr("Invalid role selected.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createName.trim(),
          email: createEmail.trim().toLowerCase(),
          role: createRole,
        }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(j.error || `Failed to create user (${res.status})`);
      }

      // Add to list immediately (API returns the created row)
      const created: Row = j;
      setRows((list) => [created, ...list]);

      setCreateMsg(
        `Created account for ${created.email}. Credentials were sent via email.`
      );
      setCreateName("");
      setCreateEmail("");
      setCreateRole("assistant");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to create user");
    } finally {
      setBusy(false);
    }
  }

  const countByRole = useMemo(() => {
    const m = new Map<Role, number>();
    ALL_ROLES.forEach((r) => m.set(r, 0));
    rows.forEach((r) => m.set(r.role, (m.get(r.role) || 0) + 1));
    return m;
  }, [rows]);

  // Pagination calculations
  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil((totalItems || 1) / PAGE_SIZE));
  const startIndex = (page - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalItems);

  const rawPageRows = filtered.slice(startIndex, endIndex);
  // Remove current admin from paged table rows (shown in its own card)
  const pageRows =
    selfRow != null ? rawPageRows.filter((r) => r.id !== selfRow.id) : rawPageRows;

  const adminRows = pageRows.filter((r) => r.role === "admin");
  const otherRows = pageRows.filter((r) => r.role !== "admin");

  const renderRow = (r: Row) => {
    const isSelf =
      (currentUserId && r.id === currentUserId) ||
      (currentUserEmail && r.email === currentUserEmail);

    const isEditing = editingId === r.id;
    const currentDraft = isEditing ? (draftRole ?? r.role) : r.role;

    return (
      <tr key={r.id} className="border-t border-[var(--border)]">
        <td className="px-4 py-3 font-medium">
          {r.email}
          {isSelf && (
            <span className="ml-1 text-[11px] uppercase text-muted">(you)</span>
          )}
        </td>

        <td className="px-4 py-3">{r.full_name || "—"}</td>

        <td className="px-4 py-3">
          {isSelf ? (
            <span
              className="text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-full"
              style={{ background: "#eef5cf" }}
            >
              {r.role}
            </span>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-full"
                style={{ background: "#eef5cf" }}
              >
                {r.role}
              </span>

              {!isEditing ? (
                <button
                  className="rounded-lg px-3 py-1 ring-1 ring-[var(--border)] bg-white/80 hover:bg-neutral-50 text-sm"
                  onClick={() => {
                    setEditingId(r.id);
                    setDraftRole(r.role);
                    setErr(null);
                  }}
                  disabled={busy}
                  title="Edit role"
                >
                  Edit
                </button>
              ) : (
                <>
                  <select
                    className="rounded-lg px-2 py-1 ring-1 ring-[var(--border)] bg-white/80"
                    value={currentDraft}
                    onChange={(e) => setDraftRole(e.target.value as Role)}
                    disabled={busy}
                  >
                    {ALL_ROLES.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>

                  <button
                    className="rounded-lg px-3 py-1 bg-black text-white text-sm disabled:opacity-50"
                    onClick={() => openConfirm(r)}
                    disabled={busy || !draftRole || draftRole === r.role}
                    title="Save role change"
                  >
                    Save
                  </button>

                  <button
                    className="rounded-lg px-3 py-1 ring-1 ring-[var(--border)] bg-white/80 hover:bg-neutral-50 text-sm"
                    onClick={resetEdit}
                    disabled={busy}
                    title="Cancel"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          )}
        </td>

        <td className="px-4 py-3">
          {new Date(r.created_at).toLocaleDateString()}
        </td>

        <td className="px-4 py-3 text-right">
          {!isSelf && (
            <button
              className="btn btn-ghost text-red-600"
              onClick={() => deleteUser(r.id, r.email)}
              disabled={busy}
            >
              Delete
            </button>
          )}
        </td>
      </tr>
    );
  };

  return (
    <Guard requireAuth roles={["admin"]}>
      <div className="space-y-6">
        {/* Header + search */}
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Users</h1>
            <p className="text-sm text-muted">Manage roles, create staff accounts, and delete accounts.</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="rounded-xl px-4 py-2 bg-black text-white text-sm disabled:opacity-50"
              onClick={openCreate}
              disabled={busy}
              title="Create staff account"
            >
              + Create staff
            </button>

            <input
              placeholder="Search email, name, role…"
              className="rounded-xl px-3 py-2 ring-1 ring-[var(--border)] bg-white/70 outline-none w-72"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
            <button className="btn btn-ghost" onClick={load} disabled={busy}>
              {busy ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {ALL_ROLES.map((r) => (
            <div key={r} className="card p-3 text-sm">
              <div className="opacity-70 capitalize">{r}</div>
              <div className="text-xl font-semibold">{countByRole.get(r) || 0}</div>
            </div>
          ))}
        </div>

        {/* Pinned admin profile card */}
        {selfRow && (
          <div className="card p-4 flex flex-wrap items-center justify-between gap-4 border border-amber-100 bg-gradient-to-r from-amber-50 to-white">
            <div>
              <div className="text-xs uppercase tracking-wide text-amber-700 mb-1">
                Your admin account
              </div>
              <div className="font-semibold">{selfRow.full_name || selfRow.email}</div>
              <div className="text-xs text-muted">{selfRow.email}</div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-800 font-medium uppercase tracking-wide">
                ADMIN
              </span>
              <div className="text-muted">
                Joined{" "}
                <span className="font-medium">
                  {new Date(selfRow.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Main table */}
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--muted)]">
                <tr>
                  <th className="text-left px-4 py-3">Email</th>
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-4 py-3">Role</th>
                  <th className="text-left px-4 py-3">Created</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-muted">
                      {busy ? "Loading…" : "No users match your search."}
                    </td>
                  </tr>
                ) : (
                  <>
                    {adminRows.length > 0 && (
                      <>
                        <tr>
                          <td
                            colSpan={5}
                            className="px-4 pt-4 pb-2 text-[11px] uppercase tracking-wide text-muted"
                          >
                            Admin accounts
                          </td>
                        </tr>
                        {adminRows.map(renderRow)}
                      </>
                    )}

                    {otherRows.length > 0 && (
                      <>
                        <tr>
                          <td
                            colSpan={5}
                            className="px-4 pt-4 pb-2 text-[11px] uppercase tracking-wide text-muted"
                          >
                            Other users
                          </td>
                        </tr>
                        {otherRows.map(renderRow)}
                      </>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalItems > 0 && (
            <div className="flex items-center justify-between px-4 py-3 text-xs text-muted">
              <div>
                Showing{" "}
                <span className="font-medium">
                  {startIndex + 1}–{endIndex}
                </span>{" "}
                of <span className="font-medium">{totalItems}</span> users
              </div>
              <div className="flex gap-2">
                <button
                  className="btn btn-ghost px-3 py-1"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Previous
                </button>
                <span>
                  Page <span className="font-medium">{page}</span> of{" "}
                  <span className="font-medium">{totalPages}</span>
                </span>
                <button
                  className="btn btn-ghost px-3 py-1"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {err && <div className="p-3 text-sm text-red-600">{err}</div>}
        </div>

        {/* Confirm Modal (role change) */}
        {confirmOpen && confirmTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl ring-1 ring-[var(--border)]">
              <div className="p-4 border-b">
                <div className="text-lg font-semibold">Confirm role change</div>
                <div className="text-sm text-muted">
                  This is a privileged action. Please confirm carefully.
                </div>
              </div>

              <div className="p-4 space-y-3">
                <div className="text-sm">
                  <div className="text-xs text-muted">User</div>
                  <div className="font-medium">{confirmTarget.email}</div>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <span className="px-2 py-1 rounded-full bg-gray-100">
                    {confirmTarget.from}
                  </span>
                  <span className="opacity-70">→</span>
                  <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-800">
                    {confirmTarget.to}
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Reason (required)</label>
                  <input
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    placeholder='e.g., "Moved to Sales team"'
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">
                    Type <span className="font-semibold">CHANGE</span> to confirm
                  </label>
                  <input
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="CHANGE"
                  />
                </div>

                <div className="text-xs text-muted">
                  This action will be recorded in the audit log.
                </div>
              </div>

              <div className="p-4 border-t flex items-center justify-end gap-2">
                <button
                  className="rounded-xl px-4 py-2 ring-1 ring-[var(--border)] hover:bg-neutral-50"
                  onClick={() => {
                    closeConfirm();
                    setErr(null);
                  }}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  className="rounded-xl bg-black text-white px-4 py-2 disabled:opacity-50"
                  onClick={submitRoleChange}
                  disabled={busy}
                >
                  {busy ? "Saving…" : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Staff Modal */}
        {createOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl ring-1 ring-[var(--border)]">
              <div className="p-4 border-b">
                <div className="text-lg font-semibold">Create staff account</div>
                <div className="text-sm text-muted">
                  A temporary password will be generated and sent to the staff email.
                </div>
              </div>

              <div className="p-4 space-y-3">
                {createMsg && (
                  <div className="text-xs px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700">
                    {createMsg}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-sm font-medium">Full name</label>
                  <input
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="Juan Dela Cruz"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Email</label>
                  <input
                    type="email"
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    value={createEmail}
                    onChange={(e) => setCreateEmail(e.target.value)}
                    placeholder="staff@clinic.com"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Role</label>
                  <select
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    value={createRole}
                    onChange={(e) => setCreateRole(e.target.value as Role)}
                  >
                    {CREATE_ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <div className="text-xs text-muted">
                    Note: Patients should use self-registration on the login page.
                  </div>
                </div>
              </div>

              <div className="p-4 border-t flex items-center justify-end gap-2">
                <button
                  className="rounded-xl px-4 py-2 ring-1 ring-[var(--border)] hover:bg-neutral-50"
                  onClick={closeCreate}
                  disabled={busy}
                >
                  Close
                </button>
                <button
                  className="rounded-xl bg-black text-white px-4 py-2 disabled:opacity-50"
                  onClick={submitCreate}
                  disabled={busy}
                >
                  {busy ? "Creating…" : "Create & email credentials"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Guard>
  );
}
