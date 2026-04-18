/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/dashboard/purchase-orders/page.tsx

"use client";

import { useEffect, useState } from "react";
import Guard from "@/components/auth/Guard";
import Link from "next/link";

// Mas malawak na type para sakop ang Cancelled din
type POStatus = "Pending" | "Processing" | "Shipped" | "Delivered" | "Cancelled";

type Row = {
  id: string;
  poNumber: string;
  dateIssued: string;
  status: POStatus;
  invoiceUrl?: string | null;
  itemsCount: number;
  total: number; // laging number sa UI
};

// Mga status na pwedeng baguhin ni supplier
const SUPPLIER_STATUS_OPTIONS: POStatus[] = ["Pending", "Processing", "Shipped"];

export default function SupplierPurchaseOrdersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/supplier/purchase-orders");
      if (!res.ok) {
        throw new Error(
          (await res.json().catch(() => ({}))).error || `Failed (${res.status})`,
        );
      }

      const data = (await res.json()) as any[];

      // make sure na total ay number at dateIssued ay string
      const normalized: Row[] = (data || []).map((r) => ({
        id: String(r.id ?? r._id),
        poNumber: String(r.poNumber),
        dateIssued: r.dateIssued ?? r.createdAt ?? new Date().toISOString(),
        status: r.status as POStatus,
        invoiceUrl: r.invoiceUrl ?? null,
        itemsCount: Number(r.itemsCount ?? (r.items?.length ?? 0)),
        total: Number(r.total ?? 0),
      }));

      setRows(normalized);
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function updateStatus(id: string, nextStatus: POStatus) {
    const prev = rows.slice();

    // Optimistic update (local lang muna)
    setRows((list) =>
      list.map((r) => (r.id === id ? { ...r, status: nextStatus } : r)),
    );

    try {
      const res = await fetch("/api/supplier/purchase-orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: nextStatus }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Update failed");
      }

      // Body is ignored on purpose — we already updated locally
      await res.json().catch(() => null);
    } catch (e: any) {
      // Error → rollback to previous list
      setErr(e?.message || "Update failed");
      setRows(prev);
    }
  }

  return (
    <Guard requireAuth roles={["supplier"]}>
      <div className="p-6 space-y-6">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Purchase Orders</h1>
            <p className="text-sm text-muted">Orders assigned to your account.</p>
          </div>
          <button className="btn btn-ghost" onClick={load} disabled={busy}>
            {busy ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--muted)]">
                <tr>
                  <th className="text-left px-4 py-3">PO #</th>
                  <th className="text-left px-4 py-3">Issued</th>
                  <th className="text-left px-4 py-3">Items</th>
                  <th className="text-left px-4 py-3">Total</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Invoice</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-[var(--border)]">
                    {/* PO # link to detail page */}
                    <td className="px-4 py-3 font-medium">
                      <Link
                        href={`/dashboard/purchase-orders/${r.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {r.poNumber}
                      </Link>
                    </td>

                    <td className="px-4 py-3">
                      {new Date(r.dateIssued).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">{r.itemsCount}</td>
                    <td className="px-4 py-3">
                      ₱{Number(r.total).toLocaleString("en-PH")}
                    </td>

                    <td className="px-4 py-3">
                      {/* Kapag Delivered/Cancelled → read-only badge; iba → dropdown */}
                      {r.status === "Delivered" || r.status === "Cancelled" ? (
                        <span className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                          {r.status}
                        </span>
                      ) : (
                        <select
                          className="rounded-lg px-2 py-1 ring-1 ring-[var(--border)] bg-white/80"
                          value={r.status}
                          onChange={(e) =>
                            updateStatus(r.id, e.target.value as POStatus)
                          }
                        >
                          {SUPPLIER_STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {r.invoiceUrl ? (
                        <Link
                          href={r.invoiceUrl}
                          target="_blank"
                          className="text-blue-600 hover:underline"
                        >
                          View
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-muted">
                      {busy ? "Loading…" : "No purchase orders yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

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
