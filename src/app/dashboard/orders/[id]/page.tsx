// src/app/dashboard/orders/[id]/page.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import { use, useCallback, useEffect, useState } from "react";
import Guard from "@/components/auth/Guard";
import Link from "next/link";

type Item = { name: string; qty: number; price: number; subtotal: number };
type PO = {
  id: string;
  poNumber: string;
  dateIssued: string;
  supplierEmail: string | null;
  status: "Pending" | "Processing" | "Shipped" | "Delivered" | "Cancelled";
  notes: string | null;
  invoiceUrl: string | null;
  items: Item[];
  total: number;
};

// For per-PO chat between clinic and supplier
type Message = {
  id: string;
  fromRole: string; 
  text: string;
  createdAt: string;
};

// --- Color-coded status badge (same style as Orders list) ---
function StatusBadge({ status }: { status: PO["status"] }) {
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

export default function AssistantPoDetail(
  { params }: { params: Promise<{ id: string }> } 
) {
  // unwrap the route params
  const { id } = use(params);

  const [po, setPo] = useState<PO | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");

  // --- chat state (assistant side) ---
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [msgBusy, setMsgBusy] = useState(false);
  const [msgErr, setMsgErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/assistant/purchase-orders/${id}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Failed (${res.status})`);
      }
      const data: PO = await res.json();
      setPo(data);
      setNotesDraft(data.notes ?? "");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setBusy(false);
    }
  }, [id]);

  // load PO
  useEffect(() => {
    void load();
  }, [load]);

  // load messages for this PO
  const loadMessages = useCallback(async () => {
    setMsgErr(null);
    try {
      const res = await fetch(
        `/api/purchase-orders/${id}/messages`,
        { cache: "no-store" }
      );
      const j = await res.json();
      if (!res.ok || !j.ok) {
        throw new Error(j.error || `Failed (${res.status})`);
      }
      setMessages(j.items || []);
    } catch (e: any) {
      setMsgErr(e.message || "Failed to load messages");
    }
  }, [id]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  async function sendMessage() {
    if (!newMsg.trim()) return;
    setMsgBusy(true);
    setMsgErr(null);
    try {
      const res = await fetch(`/api/purchase-orders/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newMsg.trim() }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        throw new Error(j.error || `Failed (${res.status})`);
      }
      setNewMsg("");
      await loadMessages();
    } catch (e: any) {
      setMsgErr(e.message || "Failed to send");
    } finally {
      setMsgBusy(false);
    }
  }

  async function markDelivered() {
    if (!po) return;
    if (!confirm("Mark this PO as Delivered?")) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/assistant/purchase-orders/${po.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_delivered" }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Failed to mark as delivered");
      }
      const j = await res.json();
      setPo((p) =>
        p
          ? {
              ...p,
              status: j.status as PO["status"],
              invoiceUrl: j.invoiceUrl ?? p.invoiceUrl,
            }
          : p
      );
    } catch (e: any) {
      setErr(e?.message || "Failed to mark as delivered");
    } finally {
      setBusy(false);
    }
  }

  async function saveNotes() {
    if (!po) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/assistant/purchase-orders/${po.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_notes", notes: notesDraft }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Save failed");
      }
      const j = await res.json();
      setPo((p) => (p ? { ...p, notes: j.notes } : p));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function cancelPo() {
    if (!po) return;
    if (!confirm("Cancel this purchase order?")) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/assistant/purchase-orders/${po.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Cancel failed");
      }
      const j = await res.json();
      setPo((p) => (p ? { ...p, status: j.status as PO["status"] } : p));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setBusy(false);
    }
  }

  const canCancel =
    po && !["Shipped", "Delivered", "Cancelled"].includes(po.status);

  return (
    <Guard requireAuth roles={["assistant", "doctor", "admin"]}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">PO Details</h1>
            <p className="text-sm text-muted">
              <Link
                href="/dashboard/orders"
                className="text-blue-600 hover:underline"
              >
                Back to Orders
              </Link>
            </p>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-ghost" onClick={load} disabled={busy}>
              {busy ? "Refreshing…" : "Refresh"}
            </button>
            <button
              className="rounded px-3 py-2 ring-1 ring-[var(--border)] hover:bg-neutral-50 disabled:opacity-50"
              onClick={cancelPo}
              disabled={busy || !canCancel}
              title={
                canCancel ? "Cancel order" : "Cannot cancel in current status"
              }
            >
              Cancel Order
            </button>
            {po && po.status === "Shipped" && (
              <button
                className="rounded bg-black text-white px-3 py-2 text-sm disabled:opacity-50"
                onClick={markDelivered}
                disabled={busy}
              >
                Mark as Delivered
              </button>
            )}
          </div>
        </div>

        {!po && !err && <div className="text-sm text-muted">Loading…</div>}
        {err && (
          <div className="text-sm" style={{ color: "#b10d0d" }}>
            {err}
          </div>
        )}

        {po && (
          <div className="space-y-4">
            {/* Header card */}
            <div className="card p-4">
              <div className="flex flex-wrap items-center gap-6">
                <div>
                  <div className="text-xs text-muted">PO #</div>
                  <div className="font-semibold">{po.poNumber}</div>
                </div>
                <div>
                  <div className="text-xs text-muted">Issued</div>
                  <div>{new Date(po.dateIssued).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-muted">Supplier</div>
                  <div>{po.supplierEmail || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted">Status</div>
                  <StatusBadge status={po.status} />
                </div>
                <div>
                  <div className="text-xs text-muted">Invoice</div>
                  {po.invoiceUrl ? (
                    <a
                      href={po.invoiceUrl}
                      target="_blank"
                      className="text-blue-600 hover:underline"
                    >
                      View
                    </a>
                  ) : (
                    "—"
                  )}
                </div>
              </div>
            </div>

            {/* Items table */}
            <div className="card p-0 overflow-hidden">
              <div className="border-b px-4 py-3 font-medium">Items</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--muted)]">
                    <tr>
                      <th className="text-left px-4 py-3">Name</th>
                      <th className="text-right px-4 py-3">Qty</th>
                      <th className="text-right px-4 py-3">Price</th>
                      <th className="text-right px-4 py-3">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {po.items.map((it, i) => (
                      <tr key={i} className="border-t border-[var(--border)]">
                        <td className="px-4 py-3">{it.name}</td>
                        <td className="px-4 py-3 text-right">{it.qty}</td>
                        <td className="px-4 py-3 text-right">
                          ₱{it.price.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          ₱{it.subtotal.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold">
                      <td className="px-4 py-3 text-right" colSpan={3}>
                        Total
                      </td>
                      <td className="px-4 py-3 text-right">
                        ₱{po.total.toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Messages with supplier */}
            <div className="card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-medium text-sm">
                  Messages with supplier
                </div>
                <button
                  className="text-xs text-blue-600 underline"
                  onClick={() => loadMessages()}
                >
                  Refresh
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto border rounded-lg p-2 bg-white/60 text-sm">
                {messages.length === 0 ? (
                  <div className="text-xs text-muted">No messages yet.</div>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className="mb-2">
                      <div className="text-[11px] text-neutral-500">
                        {m.fromRole === "supplier"
                          ? "Supplier"
                          : "You (assistant)"}{" "}
                        · {new Date(m.createdAt).toLocaleString()}
                      </div>
                      <div className="text-sm whitespace-pre-wrap">
                        {m.text}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {msgErr && (
                <div className="text-xs text-red-600">{msgErr}</div>
              )}

              <div className="flex gap-2">
                <textarea
                  className="flex-1 rounded border px-2 py-1 text-sm"
                  rows={2}
                  placeholder="Type a message to the supplier…"
                  value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
                />
                <button
                  className="rounded bg-black text-white px-3 py-2 text-xs disabled:opacity-50"
                  disabled={msgBusy || !newMsg.trim()}
                  onClick={sendMessage}
                >
                  {msgBusy ? "Sending…" : "Send"}
                </button>
              </div>
            </div>

            {/* Notes editor */}
            <div className="card p-4 space-y-3">
              <div className="font-medium">Notes</div>
              <textarea
                className="w-full rounded border px-3 py-2"
                rows={4}
                placeholder="Notes for this order"
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
              />
              <div className="flex justify-end">
                <button
                  className="rounded bg-black text-white px-4 py-2 text-sm disabled:opacity-50"
                  onClick={saveNotes}
                  disabled={busy}
                >
                  Save Notes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Guard>
  );
}
