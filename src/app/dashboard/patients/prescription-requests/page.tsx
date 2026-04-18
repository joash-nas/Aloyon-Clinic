/* =============================================================================
   File: src/app/dashboard/patients/prescription-requests/page.tsx
   Purpose: Staff view of all prescription requests.
            - See pending requests
            - Open email client with pre-filled message
            - Mark as "sent" or "rejected"
   ============================================================================ */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type RequestStatus = "pending" | "sent" | "rejected";

type StaffReqItem = {
  id: string;
  patientId: string | null;
  patientEmail: string | null;
  patientName: string | null;
  message: string | null;
  status: RequestStatus;
  createdAt: string;
};

export default function PrescriptionRequestsBoard() {
  const [items, setItems] = useState<StaffReqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(
        "/api/prescriptions/requests?scope=all&status=pending",
        { cache: "no-store" }
      );
      const j = await res.json();
      if (!res.ok || !j.ok) {
        throw new Error(j.error || `Failed (${res.status})`);
      }
      setItems(j.items || []);
    } catch (e: any) {
      setErr(e.message || "Failed to load requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function openEmail(item: StaffReqItem) {
  if (!item.patientEmail) return;

  const name = item.patientName || "patient";
  const subject = "Aloyon Optical - [PRESCRIPTION REQUEST]";
  const body =
    `Hi ${name},\n\n` +
    `This is your prescription from Aloyon Optical. ` +
    `I have attached your prescription file/screenshot to this email.\n\n` +
    `If you did not request this, please contact the clinic.\n\n` +
    `Thank you,\nAloyon Optical`;

  // Gmail web compose URL
  const url =
    "https://mail.google.com/mail/u/0/?view=cm&fs=1" +
    `&to=${encodeURIComponent(item.patientEmail)}` +
    `&su=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`;

  // Open Gmail compose in a new tab
  window.open(url, "_blank", "noopener,noreferrer");
}


  async function updateStatus(id: string, action: "mark_sent" | "reject") {
    setBusyId(id);
    setErr(null);
    try {
      const res = await fetch(`/api/prescriptions/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        throw new Error(j.error || `Failed (${res.status})`);
      }
      await load();
    } catch (e: any) {
      setErr(e.message || "Failed to update request.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="card p-5 rounded-2xl ring-1 ring-[var(--border)] bg-white/70 space-y-4">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Prescription requests</h1>
          
        </div>
        <Link
          href="/dashboard/patients"
          className="text-sm underline text-neutral-700"
        >
          ← Back to patient list
        </Link>
      </header>

      {err && <div className="text-sm text-rose-600">{err}</div>}

      {loading ? (
        <div className="text-sm opacity-70">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-sm opacity-70">No pending prescription requests.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-neutral-600 border-b border-[var(--border)]">
                <th className="py-2 pr-4">Patient</th>
                <th className="py-2 pr-4">Requested at</th>
                <th className="py-2 pr-4">Message</th>
                <th className="py-2 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-b border-[var(--border)]">
                  <td className="py-2 pr-4">
                    <div className="font-medium">
                      {r.patientName || "Unnamed patient"}
                    </div>
                    <div className="text-xs text-neutral-600">
                      {r.patientEmail || "No email"}
                    </div>
                    {r.patientId && (
                      <Link
                        href={`/dashboard/patients/${r.patientId}`}
                        className="text-[11px] underline text-neutral-700"
                      >
                        View patient record
                      </Link>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-xs text-neutral-700">
                    {new Date(r.createdAt).toLocaleString("en-PH", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="py-2 pr-4 text-xs text-neutral-700 max-w-xs">
                    {r.message || "—"}
                  </td>
                  <td className="py-2 pr-4 space-y-1">
                    <button
                      type="button"
                      onClick={() => openEmail(r)}
                      className="w-full rounded-full border px-3 py-1 text-xs hover:bg-black/5"
                    >
                      Send email prescription
                    </button>
                    <button
                      type="button"
                      onClick={() => updateStatus(r.id, "mark_sent")}
                      disabled={busyId === r.id}
                      className="w-full rounded-full px-3 py-1 text-xs text-white disabled:opacity-60"
                      style={{ background: "#111" }}
                    >
                      {busyId === r.id ? "Saving…" : "Mark email sent"}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateStatus(r.id, "reject")}
                      disabled={busyId === r.id}
                      className="w-full rounded-full border px-3 py-1 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                    >
                      Reject request
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
