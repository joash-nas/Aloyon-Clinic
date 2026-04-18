/* =============================================================================
   File: src/app/dashboard/prescriptions/page.tsx
   Purpose: Patient-facing prescriptions page
            - View status of prescription requests
            - Create a new request (one pending at a time)
   ============================================================================ */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";

type RequestStatus = "pending" | "sent" | "rejected";

type ReqItem = {
  id: string;
  status: RequestStatus;
  message: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  resolutionNote: string | null;
};

export default function PatientPrescriptionsPage() {
  const [items, setItems] = useState<ReqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const hasPending = items.some((r) => r.status === "pending");
  const latest = items[0] ?? null;

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(
        "/api/prescriptions/requests?scope=self",
        { cache: "no-store" }
      );
      const j = await res.json();
      if (!res.ok || !j.ok) {
        throw new Error(j.error || `Failed (${res.status})`);
      }
      setItems(j.items || []);
    } catch (e: any) {
      setErr(e.message || "Failed to load prescription requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createRequest() {
    if (hasPending) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/prescriptions/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim() || undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        throw new Error(j.error || "Could not submit request.");
      }
      setMessage("");
      await load();
    } catch (e: any) {
      setErr(e.message || "Could not submit request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-5 rounded-2xl ring-1 ring-[var(--border)] bg-white/70 space-y-5">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Prescriptions</h1>
          <p className="text-sm text-neutral-600">
            Request a copy of your latest prescription. The clinic will review and
            send it to your registered email.
          </p>
        </div>
      </header>

      {loading ? (
        <div className="text-sm opacity-70">Loading…</div>
      ) : (
        <>
          {/* Latest status card */}
          {latest ? (
            <section className="rounded-xl bg-[var(--muted)] px-4 py-3 text-sm">
              <div className="flex items-center justify-between gap-3 mb-1">
                <div className="font-medium">Latest request</div>
                <span
                  className={[
                    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                    latest.status === "pending"
                      ? "bg-amber-100 text-amber-700"
                      : latest.status === "sent"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-rose-100 text-rose-700",
                  ].join(" ")}
                >
                  {latest.status === "pending"
                    ? "Pending review"
                    : latest.status === "sent"
                    ? "Email sent"
                    : "Rejected"}
                </span>
              </div>
              <div className="text-xs text-neutral-600">
                Requested on{" "}
                {new Date(latest.createdAt).toLocaleString("en-PH", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </div>
              {latest.status === "sent" && (
                <div className="mt-2 text-xs text-emerald-700">
                  Your prescription has been sent to your email. Please check your
                  inbox (and spam folder).
                </div>
              )}
              {latest.status === "rejected" && (
                <div className="mt-2 text-xs text-rose-700">
                  This request was rejected by the clinic.
                  {latest.resolutionNote && (
                    <>
                      {" "}
                      Reason: <span className="font-medium">{latest.resolutionNote}</span>
                    </>
                  )}
                </div>
              )}
            </section>
          ) : (
            <section className="rounded-xl bg-[var(--muted)] px-4 py-3 text-sm">
              You have not requested a prescription yet.
            </section>
          )}

          {/* New request form */}
          <section className="space-y-2">
            <h2 className="text-sm font-medium">Request a prescription</h2>
            <p className="text-xs text-neutral-600">
              Use this form to request a copy of your latest prescription. The clinic
              may only send prescriptions if your last eye exam is still valid.
            </p>

            <textarea
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
              rows={3}
              placeholder="Optional message to the clinic (e.g. why you need the prescription)…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={busy}
            />

            {err && <div className="text-sm text-rose-600">{err}</div>}

            <button
              onClick={createRequest}
              disabled={busy || hasPending}
              className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              style={{ background: "#111" }}
            >
              {hasPending
                ? "You already have a pending request"
                : busy
                ? "Sending request…"
                : "Send prescription request"}
            </button>
          </section>

          {/* History */}
          {items.length > 1 && (
            <section className="pt-2 border-t border-[var(--border)]">
              <h3 className="text-sm font-medium mb-2">Request history</h3>
              <ul className="space-y-1 text-xs">
                {items.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-black/5"
                  >
                    <div>
                      <div className="font-medium">
                        {r.status === "pending"
                          ? "Pending request"
                          : r.status === "sent"
                          ? "Prescription emailed"
                          : "Request rejected"}
                      </div>
                      <div className="text-[11px] text-neutral-600">
                        {new Date(r.createdAt).toLocaleString("en-PH", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </div>
                    </div>
                    <span
                      className={[
                        "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium",
                        r.status === "pending"
                          ? "bg-amber-100 text-amber-700"
                          : r.status === "sent"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-rose-100 text-rose-700",
                      ].join(" ")}
                    >
                      {r.status}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
