/* =============================================================================
   File: src/app/dashboard/shop-orders/page.tsx
   Purpose:
     Shared dashboard route for shop orders.
     - Patients: see their own pickup orders (read-only).
     - Assistants: manage all pickup orders and update statuses.
   Notes:
     • Uses /api/me/orders for patient view.
     • Uses /api/staff/orders and /api/staff/orders/[id] for assistant view.
   ============================================================================ */

"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthContext";

/* ---------------------------------------------------------------------------
   Shared helpers
--------------------------------------------------------------------------- */

type Status = "pending" | "preparing" | "ready" | "completed" | "cancelled";

function StatusPill({ status }: { status: Status }) {
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  let bg = "#e5e7eb";
  let color = "#374151";

  if (status === "pending") {
    bg = "#eff6ff";
    color = "#1d4ed8";
  } else if (status === "preparing") {
    bg = "#fef3c7";
    color = "#92400e";
  } else if (status === "ready") {
    bg = "#ecfdf3";
    color = "#166534";
  } else if (status === "completed") {
    bg = "#e0f2fe";
    color = "#075985";
  } else if (status === "cancelled") {
    bg = "#fee2e2";
    color = "#b91c1c";
  }

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] uppercase tracking-wide"
      style={{ background: bg, color }}
    >
      {label}
    </span>
  );
}

function PaymentBadge({ method, paid }: { method?: string; paid?: boolean }) {
  const label = method || "Pay on pickup";
  const isPaid = !!paid;

  const bg = isPaid ? "#dcfce7" : "#fffbeb";
  const dot = isPaid ? "#16a34a" : "#f97316";
  const txt = isPaid ? "#065f46" : "#92400e";
  const statusLabel = isPaid ? "Paid" : "Unpaid";

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
      style={{ background: bg, color: txt }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: dot }} />
      <span>{label}</span>
      <span className="uppercase tracking-wide opacity-80">{statusLabel}</span>
    </span>
  );
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDateHeader(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();

  const label = d.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return sameDay ? `Today – ${label}` : label;
}

// NEW: build local YYYY-MM-DD key (no UTC shift)
function localDateKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/* ---------------------------------------------------------------------------
   Patient view
--------------------------------------------------------------------------- */

type PatientOrderRow = {
  id: string;
  orderNumber: string;
  status: Status;
  subtotal: number;
  total: number;
  createdAt: string;
  paymentMethod: string;
  paid: boolean;
  items: { name: string; qty: number }[];
};

const PATIENT_PAGE_SIZE = 8;

function PatientOrders() {
  const [orders, setOrders] = useState<PatientOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [page, setPage] = useState(1);

  const total = orders.length;
  const totalPages = Math.max(1, Math.ceil(total / PATIENT_PAGE_SIZE));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const pagedOrders = useMemo(() => {
    const start = (page - 1) * PATIENT_PAGE_SIZE;
    return orders.slice(start, start + PATIENT_PAGE_SIZE);
  }, [orders, page]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const res = await fetch("/api/me/orders", { cache: "no-store" });
        if (!res.ok) throw new Error(await res.text());
        const json = (await res.json()) as { items?: PatientOrderRow[] };

        const items = json.items || [];

        if (!cancelled) {
          setOrders(items);
          setErr(null);
          setPage(1); // reset to first page after loading
        }
      } catch (e) {
        console.error("Failed to load patient orders:", e);
        if (!cancelled) {
          setErr("Failed to load your shop orders. Please try again later.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Shop orders</h1>
        <p className="text-sm text-muted">
          View the orders you placed from the Aloyon Optical shop. All orders
          are for in-clinic pickup only.
        </p>
      </div>

      {loading ? (
        <div className="card p-4 text-sm text-muted">Loading your orders…</div>
      ) : err ? (
        <div className="card p-4 text-sm text-red-600">{err}</div>
      ) : orders.length === 0 ? (
        <div className="card p-4 text-sm text-muted">
          You haven&apos;t placed any shop orders yet.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl ring-1 ring-[var(--border)] bg-white/70 dark:bg-white/5">
            <table className="min-w-full table-auto text-sm">
              <thead className="bg-[var(--muted)] text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 text-left">Order no.</th>
                  <th className="px-4 py-3 text-left">Placed on</th>
                  <th className="px-4 py-3 text-left">Items</th>
                  <th className="px-4 py-3 text-left">Payment</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {pagedOrders.map((o) => {
                  const summary =
                    (o.items ?? [])
                      .map((it) => `${it.name} (x${it.qty})`)
                      .join(", ") || "—";

                  return (
                    <tr key={o.id} className="border-t border-[var(--border)]">
                      <td className="px-4 py-3 font-medium">{o.orderNumber}</td>
                      <td className="px-4 py-3 text-xs text-muted">
                        {formatDateTime(o.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">{summary}</td>
                      <td className="px-4 py-3">
                        <PaymentBadge method={o.paymentMethod} paid={o.paid} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={o.status} />
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        ₱{o.total.toLocaleString("en-PH")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination (patient) */}
          {total > 0 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                className={`btn btn-ghost ${
                  !canPrev ? "pointer-events-none opacity-50" : ""
                }`}
                onClick={() => canPrev && setPage((p) => p - 1)}
              >
                ← Prev
              </button>

              <div className="text-xs text-muted">
                Showing {pagedOrders.length} of {total} order
                {total === 1 ? "" : "s"} (page {page} of {totalPages})
              </div>

              <button
                className={`btn btn-ghost ${
                  !canNext ? "pointer-events-none opacity-50" : ""
                }`}
                onClick={() => canNext && setPage((p) => p + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Assistant view
--------------------------------------------------------------------------- */

type StaffOrderRow = {
  id: string;
  orderNumber: string;
  userEmail: string;
  status: Status;
  subtotal: number;
  total: number;
  createdAt: string;
  paymentMethod: string;
  paid: boolean;
  readyEmailSentAt?: string | null; // add
  items: { name: string; qty: number }[];
};

const STAFF_LIMIT = 8; // show 8 orders per page

function AssistantOrders() {
  const [orders, setOrders] = useState<StaffOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("pending");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [emailingId, setEmailingId] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const totalPages = Math.max(1, Math.ceil(total / STAFF_LIMIT));
  const canPrev = page > 1;
  const canNext = page < totalPages;

    const sendReadyEmail = async (id: string, force = false) => {
    try {
      setEmailingId(id);
      const res = await fetch(`/api/staff/orders/${id}/notify-ready`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const j = await res.json().catch(() => ({} as any));
      if (!res.ok || !j?.ok) {
        alert(j?.error || "Failed to send email.");
        return;
      }

      // update local row so UI shows "sent"
            if (j.sent || force) {
        setOrders((cur) =>
          cur.map((o) =>
            o.id === id ? { ...o, readyEmailSentAt: new Date().toISOString() } : o
          )
        );
      }

      
      if (j.skipped) {
        alert("Ready email was already sent. Use Resend if needed.");
      } else {
        alert("Ready for pickup email sent!");
      }
    } catch (e) {
      console.error(e);
      alert("Failed to send email. Please try again.");
    } finally {
      setEmailingId(null);
    }
  };

  const load = async (targetPage = page) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(targetPage));
      params.set("limit", String(STAFF_LIMIT));
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/staff/orders?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as {
        items?: StaffOrderRow[];
        total?: number;
        page?: number;
        limit?: number;
      };
      setOrders(json.items || []);
      setTotal(json.total ?? 0);
      setPage(json.page ?? targetPage);
      setErr(null);
    } catch (e) {
      console.error("Failed to load staff orders:", e);
      setErr("Failed to load shop orders. Please try again.");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // whenever status filter changes, reset to first page
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, StaffOrderRow[]>();
    for (const o of orders) {
      const key = localDateKey(o.createdAt); // YYYY-MM-DD in local time
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(o);
    }
    for (const arr of map.values()) {
      arr.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    }
    const sortedKeys = Array.from(map.keys()).sort((a, b) =>
      a < b ? 1 : a > b ? -1 : 0
    );
    return { map, sortedKeys };
  }, [orders]);

  const handleStatusChange = async (id: string, next: Status) => {
    try {
      setSavingId(id);
      const res = await fetch(`/api/staff/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const msg = await res.text();
        console.error("Failed to update status:", msg);
        alert("Failed to update status. It may already be locked.");
        return;
      }
      setOrders((current) =>
        current.map((o) => (o.id === id ? { ...o, status: next } : o))
      );
    } catch (e) {
      console.error("Failed to update status:", e);
      alert("Failed to update status. Please try again.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Shop orders (staff)</h1>
        <p className="text-sm text-muted">
          Manage pickup orders from the online shop. Use the status to track
          progress: Pending → Preparing → Ready → Completed. All orders are for
          pickup at the clinic.{" "}
          <span className="font-medium">
            Completed and cancelled orders are locked and can&apos;t be
            modified.
          </span>
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="rounded-xl px-3 py-2 ring-1 ring-[var(--border)] bg-white/70 dark:bg-white/5 outline-none text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "all" | Status)}
        >
          <option value="pending">Pending</option>
          <option value="preparing">Preparing</option>
          <option value="ready">Ready</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="all">All statuses</option>
        </select>

        <button
          className="btn btn-ghost text-sm"
          onClick={() => load(page)}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>

        <div className="ml-auto text-xs text-muted">
          Showing {orders.length} of {total} order{total === 1 ? "" : "s"} (page{" "}
          {page} of {totalPages})
        </div>
      </div>

      {loading && (
        <div className="card p-4 text-sm text-muted">Loading shop orders…</div>
      )}

      {err && !loading && (
        <div className="card p-4 text-sm text-red-600">{err}</div>
      )}

      {!loading && !err && orders.length === 0 && (
        <div className="card p-4 text-sm text-muted">
          No shop orders match your filter.
        </div>
      )}

      {/* Grouped by day */}
      {!loading &&
        !err &&
        orders.length > 0 &&
        grouped.sortedKeys.map((key) => {
          const rows = grouped.map.get(key)!;
          return (
            <section key={key} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted px-1">
                {formatDateHeader(key)}
              </h2>
              <div className="overflow-x-auto rounded-2xl ring-1 ring-[var(--border)] bg-white/70 dark:bg-white/5">
                <table className="min-w-full table-auto text-sm">
                  <thead className="bg-[var(--muted)] text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-4 py-3 text-left">Time</th>
                      <th className="px-4 py-3 text-left">Order no.</th>
                      <th className="px-4 py-3 text-left">Customer</th>
                      <th className="px-4 py-3 text-left">Items</th>
                      <th className="px-4 py-3 text-left">Payment</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((o) => {
                      const time = new Date(o.createdAt).toLocaleTimeString(
                        "en-PH",
                        { hour: "numeric", minute: "2-digit", hour12: true }
                      );
                      const summary =
                        (o.items ?? [])
                          .map((it) => `${it.name} (x${it.qty})`)
                          .join(", ") || "—";

                      const isLocked =
                        o.status === "completed" || o.status === "cancelled";

                      return (
                        <tr
                          key={o.id}
                          className="border-t border-[var(--border)]"
                        >
                          <td className="px-4 py-3 text-xs text-muted">
                            {time}
                          </td>
                          <td className="px-4 py-3 font-medium">
                            {o.orderNumber}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted">
                            {o.userEmail || "—"}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted">
                            {summary}
                          </td>
                          <td className="px-4 py-3">
                            <PaymentBadge
                              method={o.paymentMethod}
                              paid={o.paid}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-2">
                                <StatusPill status={o.status} />

                                {isLocked ? (
                                  <span className="text-[11px] text-muted">Status locked</span>
                                ) : (
                                  <select
                                    className="text-xs rounded-lg px-2 py-1 ring-1 ring-[var(--border)] bg-white/80 outline-none"
                                    value={o.status}
                                    disabled={savingId === o.id}
                                    onChange={(e) => handleStatusChange(o.id, e.target.value as Status)}
                                  >
                                    <option value="pending">Pending</option>
                                    <option value="preparing">Preparing</option>
                                    <option value="ready">Ready</option>
                                    <option value="completed">Completed</option>
                                    <option value="cancelled">Cancelled</option>
                                  </select>
                                )}
                              </div>

                              {/* Email actions (only when READY + has email) */}
                              {o.status === "ready" && o.userEmail && o.userEmail !== "—" ? (
                                <div className="flex flex-wrap items-center gap-2">
                                  {!o.readyEmailSentAt ? (
                                    <button
                                      className="btn btn-ghost text-xs"
                                      disabled={emailingId === o.id}
                                      onClick={() => sendReadyEmail(o.id, false)}
                                    >
                                      {emailingId === o.id ? "Sending…" : "Send email"}
                                    </button>
                                  ) : (
                                    <>
                                      <span className="text-[11px] text-muted">
                                        Email sent{" "}
                                        {o.readyEmailSentAt
                                          ? `• ${new Date(o.readyEmailSentAt).toLocaleString("en-PH", {
                                              month: "short",
                                              day: "numeric",
                                              hour: "numeric",
                                              minute: "2-digit",
                                              hour12: true,
                                            })}`
                                          : ""}
                                      </span>

                                      <button
                                        className="btn btn-ghost text-xs"
                                        disabled={emailingId === o.id}
                                        onClick={() => sendReadyEmail(o.id, true)}
                                        title="Resend ready-for-pickup email"
                                      >
                                        {emailingId === o.id ? "Resending…" : "Resend"}
                                      </button>
                                    </>
                                  )}
                                </div>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">
                            ₱{o.total.toLocaleString("en-PH")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}

      {/* Pagination */}
      {!loading && !err && total > 0 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            className={`btn btn-ghost ${
              !canPrev ? "pointer-events-none opacity-50" : ""
            }`}
            onClick={() => canPrev && load(page - 1)}
          >
            ← Prev
          </button>
          <div className="text-xs text-muted">
            Page {page} of {totalPages}
          </div>
          <button
            className={`btn btn-ghost ${
              !canNext ? "pointer-events-none opacity-50" : ""
            }`}
            onClick={() => canNext && load(page + 1)}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Top-level component: decide which view to show
--------------------------------------------------------------------------- */

export default function ShopOrdersPage() {
  const { role } = useAuth();

  if (role === "assistant" || role === "admin" || role === "sales") {
    return <AssistantOrders />;
  }

  // default to patient view
  return <PatientOrders />;
}