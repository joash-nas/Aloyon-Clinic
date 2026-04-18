/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/dashboard/orders/page.tsx

"use client";

import { useEffect, useMemo, useState } from "react";
import Guard from "@/components/auth/Guard";
import Link from "next/link";

type Row = {
  id: string;
  poNumber: string;
  dateIssued: string;
  status: "Pending" | "Processing" | "Shipped" | "Delivered" | "Cancelled";
  supplierEmail?: string | null;
  itemsCount: number;
  total: number;
};

const PAGE_SIZE = 10;

// maliit na helper component para sa color-coded badge
function StatusBadge({ status }: { status: Row["status"] }) {
  const base =
    "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium";

  const cls =
    status === "Pending"
      ? "bg-gray-100 text-gray-700"
      : status === "Processing"
      ? "bg-amber-50 text-amber-700"
      : status === "Shipped"
      ? "bg-sky-50 text-sky-700"
      : status === "Delivered"
      ? "bg-emerald-50 text-emerald-700"
      : "bg-rose-50 text-rose-700"; // Cancelled

  return <span className={`${base} ${cls}`}>{status}</span>;
}

export default function AssistantOrdersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // filters
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");
  const [mine, setMine] = useState(false);

  // pagination
  const [page, setPage] = useState(1);

  async function load() {
    setBusy(true);
    setErr(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (status) params.set("status", status);
      if (mine) params.set("mine", "true");

      const res = await fetch(
        `/api/assistant/purchase-orders?${params.toString()}`
      );
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({}))).error ||
            `Failed (${res.status})`
        );
      const data: Row[] = await res.json();
      setRows(data || []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  // reload when status / mine changes and reset to first page
  useEffect(() => {
    setPage(1);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, mine]);

  // search filter
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) =>
      [r.poNumber, r.supplierEmail ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [q, rows]);

  // pagination computations
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil((total || 1) / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const startIndex = (page - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, total);
  const pageRows = filtered.slice(startIndex, endIndex);

  async function duplicate(id: string) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/assistant/purchase-orders/${id}/duplicate`,
        { method: "POST" }
      );
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({}))).error || "Duplicate failed"
        );
      await load(); // refresh list
    } catch (e: any) {
      setErr(e?.message || "Duplicate failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Guard requireAuth roles={["assistant", "doctor", "admin"]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Orders</h1>
            <p className="text-sm text-muted">
              All clinic purchase orders by supplier/status.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              placeholder="Search PO # or supplier email…"
              className="rounded-xl px-3 py-2 ring-1 ring-[var(--border)] bg-white/70 outline-none w-72"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              onKeyDown={(e) => e.key === "Enter" && load()}
            />
            <select
              className="rounded-xl px-2 py-2 ring-1 ring-[var(--border)] bg-white/70 outline-none"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="Pending">Pending</option>
              <option value="Processing">Processing</option>
              <option value="Shipped">Shipped</option>
              <option value="Delivered">Delivered</option>
              <option value="Cancelled">Cancelled</option>
            </select>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={mine}
                onChange={(e) => setMine(e.target.checked)}
              />
              Mine only
            </label>
            <button className="btn btn-ghost" onClick={load} disabled={busy}>
              {busy ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--muted)]">
                <tr>
                  <th className="text-left px-4 py-3">PO #</th>
                  <th className="text-left px-4 py-3">Issued</th>
                  <th className="text-left px-4 py-3">Supplier</th>
                  <th className="text-left px-4 py-3">Items</th>
                  <th className="text-left px-4 py-3">Total</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => (
                  <tr key={r.id} className="border-t border-[var(--border)]">
                    {/* Link to assistant detail page */}
                    <td className="px-4 py-3 font-medium">
                      <Link
                        href={`/dashboard/orders/${r.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {r.poNumber}
                      </Link>
                    </td>

                    <td className="px-4 py-3">
                      {new Date(r.dateIssued).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">{r.supplierEmail || "—"}</td>
                    <td className="px-4 py-3">{r.itemsCount}</td>
                    <td className="px-4 py-3">
                      ₱{r.total.toLocaleString("en-PH")}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className="rounded px-3 py-1 ring-1 ring-[var(--border)] hover:bg-neutral-50"
                        onClick={() => duplicate(r.id)}
                        disabled={busy}
                      >
                        Duplicate
                      </button>
                    </td>
                  </tr>
                ))}

                {pageRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-6 text-center text-muted"
                    >
                      {busy ? "Loading…" : "No orders found."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination footer */}
          {total > 0 && (
            <div className="flex items-center justify-between px-4 py-3 text-xs text-muted">
              <div>
                Showing{" "}
                <span className="font-medium">
                  {startIndex + 1}–{endIndex}
                </span>{" "}
                of <span className="font-medium">{total}</span> orders
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
                  Page{" "}
                  <span className="font-medium">{page}</span> of{" "}
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

          {err && (
            <div className="p-3 text-sm" style={{ color: "#b10d0d" }}>
              {err}
            </div>
          )}
        </div>
      </div>
    </Guard>
  );
}
