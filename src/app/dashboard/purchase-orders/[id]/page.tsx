/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/dashboard/purchase-orders/[id]/page.tsx

"use client";

import { use, useCallback, useEffect, useState } from "react";
import Guard from "@/components/auth/Guard";
import Link from "next/link";

type Item = { name: string; qty: number; price: number; subtotal: number };
type PO = {
  id: string;
  poNumber: string;
  dateIssued: string;
  status: "Pending" | "Processing" | "Shipped" | "Delivered";
  notes: string | null;
  invoiceUrl: string | null;
  items: Item[];
  total: number;
};

export default function SupplierPoDetail(
  { params }: { params: Promise<{ id: string }> } 
) {
  // Unwrap the dynamic route params (Next 15)
  const { id } = use(params);

  const [po, setPo] = useState<PO | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/supplier/purchase-orders/${id}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Failed (${res.status})`);
      }
      const data: PO = await res.json();
      setPo(data);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setBusy(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateStatus(status: PO["status"]) {
    if (!po) return;
    const prev = po;
    setPo({ ...po, status });
    try {
      const res = await fetch("/api/supplier/purchase-orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: po.id, status }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Update failed");
      }
      const updated: Partial<PO> = await res.json();
      setPo((p) => (p ? { ...p, status: (updated.status as PO["status"]) ?? p.status } : p));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Update failed");
      setPo(prev);
    }
  }
  
  type Message = { id: string; fromRole: string; text: string; createdAt: string };

const [messages, setMessages] = useState<Message[]>([]);
const [newMsg, setNewMsg] = useState("");
const [msgBusy, setMsgBusy] = useState(false);
const [msgErr, setMsgErr] = useState<string | null>(null);

async function loadMessages() {
  try {
    const res = await fetch(`/api/purchase-orders/${id}/messages`, { cache: "no-store" });
    const j = await res.json();
    if (!res.ok || !j.ok) throw new Error(j.error || `Failed (${res.status})`);
    setMessages(j.items || []);
  } catch (e: any) {
    setMsgErr(e.message || "Failed to load messages");
  }
}

useEffect(() => { void loadMessages(); }, [id]);

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
    if (!res.ok || !j.ok) throw new Error(j.error || `Failed (${res.status})`);
    setNewMsg("");
    await loadMessages();
  } catch (e: any) {
    setMsgErr(e.message || "Failed to send");
  } finally {
    setMsgBusy(false);
  }
}

  async function uploadInvoice(file: File) {
    if (!po) return;
    const fd = new FormData();
    fd.append("id", po.id);
    fd.append("invoice", file);
    const res = await fetch("/api/supplier/purchase-orders/invoice", {
      method: "POST",
      body: fd,
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error || "Upload failed");
      return;
    }
    const j = await res.json();
    setPo((p) => (p ? { ...p, invoiceUrl: j.invoiceUrl, status: j.status } : p));
  }

  return (
    <Guard requireAuth roles={["supplier"]}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">PO Details</h1>
            <p className="text-sm text-muted">
              <Link href="/dashboard/purchase-orders" className="text-blue-600 hover:underline">
                Back to list
              </Link>
            </p>
          </div>
          <button className="btn btn-ghost" onClick={load} disabled={busy}>
            {busy ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {!po && !err && <div className="text-sm text-muted">Loading…</div>}
        {err && (
          <div className="text-sm" style={{ color: "#b10d0d" }}>
            {err}
          </div>
        )}

        {po && (
          <div className="space-y-4">
            <div className="card p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <div className="text-xs text-muted">PO #</div>
                  <div className="font-semibold">{po.poNumber}</div>
                </div>
                <div>
                  <div className="text-xs text-muted">Issued</div>
                  <div>{new Date(po.dateIssued).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-muted">Status</div>
                  <select
  className="rounded-lg px-2 py-1 ring-1 ring-[var(--border)] bg-white/80"
  value={po.status}
  onChange={(e) => updateStatus(e.target.value as PO["status"])}
>
  {/* Supplier can only change up to Shipped */}
  {["Pending", "Processing", "Shipped"].map((s) => (
    <option key={s} value={s}>
      {s}
    </option>
  ))}
</select>
                </div>
                <div>
                  <div className="text-xs text-muted">Invoice</div>
                  {po.invoiceUrl ? (
                    <a href={po.invoiceUrl} target="_blank" className="text-blue-600 hover:underline">
                      View
                    </a>
                  ) : (
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <span className="text-blue-600 hover:underline">Upload</span>
                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadInvoice(f);
                          e.currentTarget.value = "";
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>

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
                        <td className="px-4 py-3 text-right">₱{it.price.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right">₱{it.subtotal.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold">
                      <td className="px-4 py-3 text-right" colSpan={3}>
                        Total
                      </td>
                      <td className="px-4 py-3 text-right">₱{po.total.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
{po && (
  <div className="card p-4 space-y-3">
    <div className="flex items-center justify-between">
      <div className="font-medium text-sm">Messages with clinic</div>
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
              {m.fromRole === "supplier" ? "You (supplier)" : "Clinic"} ·{" "}
              {new Date(m.createdAt).toLocaleString()}
            </div>
            <div className="text-sm whitespace-pre-wrap">{m.text}</div>
          </div>
        ))
      )}
    </div>

    {msgErr && <div className="text-xs text-red-600">{msgErr}</div>}

    <div className="flex gap-2">
      <textarea
        className="flex-1 rounded border px-2 py-1 text-sm"
        rows={2}
        placeholder="Type a message to the clinic…"
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
)}

            <div className="card p-4">
              <div className="text-sm text-muted mb-1">Notes</div>
              <div className="text-sm whitespace-pre-wrap">{po.notes ?? "—"}</div>
            </div>
          </div>
        )}
      </div>
    </Guard>
  );
}
