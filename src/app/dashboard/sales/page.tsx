/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import Guard from "@/components/auth/Guard";
import SalesDonut from "@/components/dashboard/sales/SalesDonut";
import DailyRevenueBar from "@/components/dashboard/sales/DailyRevenueBar";
import TopItemsBar from "@/components/dashboard/sales/TopItemsBar";
import RecentSales from "@/components/dashboard/sales/RecentSales";

type Row = {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  items?: { name: string; qty: number; price: number }[];
};

const CATS = [
  "Shop Sale",
  "Frames",
  "Lens Upgrade",
  "Checkup",
  "Accessory",
  "Solution",
  "Contact Lens",
  "Discount",
  "Other",
] as const;

const METHODS = ["Cash", "GCash", "Bank", "PayMongo", "QRPh"] as const;
type Preset =
  | "today"
  | "yesterday"
  | "last7"
  | "thisMonth"
  | "lastMonth"
  | "ytd"
  | "all"
  | "custom";

function fmt(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}
const startOfMonth = (d = new Date()) =>
  new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d = new Date()) =>
  new Date(d.getFullYear(), d.getMonth() + 1, 0);
const startOfYear = (d = new Date()) => new Date(d.getFullYear(), 0, 1);
function rangeForPreset(p: Preset) {
  const t = new Date();
  switch (p) {
    case "today":
      return { from: fmt(t), to: fmt(t) };
    case "yesterday": {
      const y = new Date(t);
      y.setDate(t.getDate() - 1);
      return { from: fmt(y), to: fmt(y) };
    }
    case "last7": {
      const f = new Date(t);
      f.setDate(t.getDate() - 6);
      return { from: fmt(f), to: fmt(t) };
    }
    case "thisMonth":
      return { from: fmt(startOfMonth(t)), to: fmt(endOfMonth(t)) };
    case "lastMonth": {
      const d = new Date(t.getFullYear(), t.getMonth() - 1, 1);
      return { from: fmt(startOfMonth(d)), to: fmt(endOfMonth(d)) };
    }
    case "ytd":
      return { from: fmt(startOfYear(t)), to: fmt(t) };
    case "all":
      return { from: "", to: "" };
    default:
      return { from: "", to: "" };
  }
}

export default function SalesPage() {
  // list
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  // filters
  const [preset, setPreset] = useState<Preset>("thisMonth");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [method, setMethod] = useState("");

  // add form (simple ledger entry)
  const [fDate, setFDate] = useState<string>("");
  const [fCat, setFCat] = useState<(typeof CATS)[number]>("Frames");
  const [fDesc, setFDesc] = useState("");
  const [fAmt, setFAmt] = useState<string>("");
  const [fMethod, setFMethod] = useState<(typeof METHODS)[number]>("Cash");

  useEffect(() => {
    const r = rangeForPreset(preset);
    setFrom(r.from);
    setTo(r.to);
  }, []); // init
  useEffect(() => {
    if (preset !== "custom") {
      const r = rangeForPreset(preset);
      setFrom(r.from);
      setTo(r.to);
    }
  }, [preset]);

  async function load() {
    setBusy(true);
    setErr(null);
    try {
      const p = new URLSearchParams();
      if (from) p.set("from", from);
      if (to) p.set("to", to);
      if (q.trim()) p.set("q", q.trim());
      if (cat) p.set("category", cat);
      if (method) p.set("method", method);
      const res = await fetch(`/api/sales/transactions?${p}`);
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({}))).error || `Failed (${res.status})`
        );
      const data = await res.json();
      setRows(data.rows || []);
      setTotal(Number(data.summary?.total || 0));
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    void load();
  }, [cat, method]);

  const filtered = useMemo(() => rows, [rows]);
  const peso = (n: number) =>
    `₱${Number(n || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  const isCustom = preset === "custom";

  async function addSale() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/sales/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: fDate || undefined,
          category: fCat,
          description: fDesc,
          amount: Number(fAmt),
          paymentMethod: fMethod,
        }),
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({}))).error || "Create failed"
        );
      setFDate("");
      setFCat("Frames");
      setFDesc("");
      setFAmt("");
      setFMethod("Cash");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Create failed");
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    if (!confirm("Delete this sale?")) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/sales/transactions/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Guard requireAuth roles={["sales", "doctor", "admin"]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Sales</h1>
            <p className="text-sm text-muted">
              Track income and analyze patterns.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded-lg px-3 py-2 ring-1 ring-[var(--border)] bg-white/70 hover:bg-neutral-50"
              onClick={() => {
                const p = new URLSearchParams();
                if (from) p.set("from", from);
                if (to) p.set("to", to);
                if (q.trim()) p.set("q", q.trim());
                if (cat) p.set("category", cat);
                if (method) p.set("method", method);
                window.open(
                  `/api/sales/transactions/export?${p}`,
                  "_blank"
                );
              }}
              disabled={busy}
            >
              Export CSV
            </button>
            <button className="btn btn-ghost" onClick={load} disabled={busy}>
              {busy ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        {/* FILTERS – top */}
        <div className="card p-3">
          <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value as Preset)}
              className="rounded-lg px-3 py-2 ring-1 ring-[var(--border)] bg-white/70"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last7">Last 7 days</option>
              <option value="thisMonth">This month</option>
              <option value="lastMonth">Last month</option>
              <option value="ytd">Year to date</option>
              <option value="all">All time</option>
              <option value="custom">Custom range…</option>
            </select>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              disabled={!(isCustom || preset === "all")}
              className="rounded-lg px-3 py-2 ring-1 ring-[var(--border)] bg-white/70 disabled:opacity-50"
            />
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              disabled={!(isCustom || preset === "all")}
              className="rounded-lg px-3 py-2 ring-1 ring-[var(--border)] bg-white/70 disabled:opacity-50"
            />
            <input
              placeholder="Search description…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              className="rounded-lg px-3 py-2 ring-1 ring-[var(--border)] bg-white/70 md:col-span-2"
            />
            <select
              value={cat}
              onChange={(e) => setCat(e.target.value)}
              className="rounded-lg px-3 py-2 ring-1 ring-[var(--border)] bg-white/70"
            >
              <option value="">All categories</option>
              {CATS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="rounded-lg px-3 py-2 ring-1 ring-[var(--border)] bg-white/70"
            >
              <option value="">All methods</option>
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end pt-3">
            <button
              className="rounded-lg px-3 py-2 ring-1 ring-[var(--border)] bg-white/70 hover:bg-neutral-50"
              onClick={load}
              disabled={busy}
            >
              Apply filters
            </button>
          </div>
        </div>

        {/* Analytics unified card */}
        <div className="card p-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <SalesDonut
                wrap="bare"
                rows={filtered}
                subtitle={
                  from && to
                    ? `${new Date(from).toLocaleDateString()} – ${new Date(
                        to
                      ).toLocaleDateString()}`
                    : "All time"
                }
              />
            </div>
            <div className="space-y-4">
              <RecentSales wrap="bare" rows={filtered} limit={6} />
              <TopItemsBar wrap="bare" rows={filtered} />
            </div>
          </div>

          <div className="grid grid-cols-1">
            <DailyRevenueBar wrap="bare" rows={filtered} />
          </div>
        </div>

        {/* Add sale (simple) */}
        <div className="card p-4 space-y-3">
          <div className="font-medium">Add sale</div>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
            <input
              type="date"
              value={fDate}
              onChange={(e) => setFDate(e.target.value)}
              className="rounded-lg px-3 py-2 ring-1 ring-[var(--border)] bg-white/70"
            />
            <select
              value={fCat}
              onChange={(e) => setFCat(e.target.value as any)}
              className="rounded-lg px-3 py-2 ring-1 ring-[var(--border)] bg-white/70"
            >
              {CATS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              placeholder="Description"
              value={fDesc}
              onChange={(e) => setFDesc(e.target.value)}
              className="rounded-lg px-3 py-2 ring-1 ring-[var(--border)] bg-white/70 md:col-span-2"
            />
            <input
              placeholder="Amount"
              value={fAmt}
              onChange={(e) => setFAmt(e.target.value)}
              className="rounded-lg px-3 py-2 ring-1 ring-[var(--border)] bg-white/70"
            />
            <select
              value={fMethod}
              onChange={(e) => setFMethod(e.target.value as any)}
              className="rounded-lg px-3 py-2 ring-1 ring-[var(--border)] bg-white/70"
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end">
            <button
              className="rounded-xl bg-black text-white px-4 py-2 text-sm disabled:opacity-50"
              onClick={addSale}
              disabled={busy}
            >
              Add Sale
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--muted)]">
                <tr>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Category</th>
                  <th className="text-left px-4 py-3">Description</th>
                  <th className="text-right px-4 py-3">Amount</th>
                  <th className="text-left px-4 py-3">Method</th>
                  <th className="text-left px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t border-[var(--border)]">
                    <td className="px-4 py-3">
                      {new Date(r.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">{r.category}</td>
                    <td className="px-4 py-3">{r.description}</td>
                    <td className="px-4 py-3 text-right">
                      {peso(r.amount)}
                    </td>
                    <td className="px-4 py-3">{r.paymentMethod}</td>
                    <td className="px-4 py-3">
                      <button
                        className="rounded-lg px-2 py-1 ring-1 ring-[var(--border)] bg-white/70 hover:bg-neutral-50"
                        onClick={() => remove(r.id)}
                        disabled={busy}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-muted"
                    >
                      {busy ? "Loading…" : "No sales found."}
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
