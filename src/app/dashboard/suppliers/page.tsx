/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/dashboard/suppliers/page.tsx


"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Guard from "@/components/auth/Guard";

type Row = {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
};

export default function AssistantSuppliersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/assistant/suppliers");
      if (!res.ok) throw new Error((await res.json().catch(()=>({}))).error || `Failed (${res.status})`);
      const data: Row[] = await res.json();
      setRows(data || []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => { void load(); }, []);

  const filtered = rows.filter(r =>
    [r.email, r.name ?? ""].join(" ").toLowerCase().includes(q.trim().toLowerCase())
  );

  return (
    <Guard requireAuth roles={["assistant", "doctor", "admin"]}>
      <div className="space-y-6 p-0 md:p-0">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Suppliers</h1>
            <p className="text-sm text-muted">Choose a supplier to create a purchase order.</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              placeholder="Search email or name…"
              className="rounded-xl px-3 py-2 ring-1 ring-[var(--border)] bg-white/70 outline-none w-72"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button className="btn btn-ghost" onClick={load} disabled={busy}>
              {busy ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--muted)]">
                <tr>
                  <th className="text-left px-4 py-3">Email</th>
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-4 py-3">Created</th>
                  <th className="text-left px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t border-[var(--border)]">
                    <td className="px-4 py-3 font-medium">{r.email}</td>
                    <td className="px-4 py-3">{r.name || "—"}</td>
                    <td className="px-4 py-3">{new Date(r.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <Link
                        className="inline-flex items-center rounded-lg px-3 py-2 ring-1 ring-[var(--border)] hover:bg-neutral-50"
                        href={`/dashboard/suppliers/${r.id}/order`}
                      >
                        Order
                      </Link>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-muted">
                      {busy ? "Loading…" : "No suppliers found."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {err && <div className="p-3 text-sm" style={{ color: "#b10d0d" }}>{err}</div>}
        </div>
      </div>
    </Guard>
  );
}
