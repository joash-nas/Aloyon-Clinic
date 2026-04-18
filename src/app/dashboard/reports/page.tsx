"use client";

import { useEffect, useState } from "react";
import Guard from "@/components/auth/Guard";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LabelList,
} from "recharts";

type AggPair = { name: string; total: number };
type DayPoint = { day: string; sales: number; expenses: number; net: number };
type TopItem = { name: string; qty: number; revenue: number };

type Summary = {
  range: { from: string | null; to: string | null };
  totals: { sales: number; expenses: number; net: number };
  series: {
    salesByDay: { day: string; total: number }[];
    expensesByDay: { day: string; total: number }[];
    netByDay: DayPoint[];
  };
  breakdown: {
    salesByCategory: AggPair[];
    expensesByCategory: AggPair[];
    topItems: TopItem[];
  };
};

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

function presetRange(p: Preset) {
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

const peso = (n: number) =>
  `₱${Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const PALETTE = [
  "#6366F1",
  "#10B981",
  "#06B6D4",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#84CC16",
  "#14B8A6",
];

export default function ReportsPage() {
  const [preset, setPreset] = useState<Preset>("thisMonth");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<Summary | null>(null);

  useEffect(() => {
    const r = presetRange(preset);
    setFrom(r.from);
    setTo(r.to);
  }, []);

  useEffect(() => {
    if (preset !== "custom") {
      const r = presetRange(preset);
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

      const res = await fetch(`/api/reports/summary?${p.toString()}`);
      if (!res.ok) throw new Error(`Load failed (${res.status})`);

      setData(await res.json());
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const net = data?.series.netByDay || [];
  const salesCat = data?.breakdown.salesByCategory || [];
  const expCat = data?.breakdown.expensesByCategory || [];
  const topItems = data?.breakdown.topItems || [];

  return (
    <Guard requireAuth roles={["admin", "doctor", "sales"]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Reports</h1>
            <p className="text-sm text-muted">
              Automated sales & expenses reporting for audits and planning.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="rounded-lg px-3 py-2 ring-1 ring-[var(--border)] bg-white/70 hover:bg-neutral-50"
              onClick={() => {
                const p = new URLSearchParams();
                if (from) p.set("from", from);
                if (to) p.set("to", to);
                window.open(
                  `/api/reports/export?kind=sales&${p.toString()}`,
                  "_blank"
                );
              }}
            >
              Export Sales CSV
            </button>

            <button
              className="rounded-lg px-3 py-2 ring-1 ring-[var(--border)] bg-white/70 hover:bg-neutral-50"
              onClick={() => {
                const p = new URLSearchParams();
                if (from) p.set("from", from);
                if (to) p.set("to", to);
                window.open(
                  `/api/reports/export?kind=expenses&${p.toString()}`,
                  "_blank"
                );
              }}
            >
              Export Expenses CSV
            </button>

            <button className="btn btn-ghost" onClick={load} disabled={busy}>
              {busy ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        <div className="card p-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
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
              disabled={!(preset === "custom" || preset === "all")}
              className="rounded-lg px-3 py-2 ring-1 ring-[var(--border)] bg-white/70 disabled:opacity-50"
            />

            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              disabled={!(preset === "custom" || preset === "all")}
              className="rounded-lg px-3 py-2 ring-1 ring-[var(--border)] bg-white/70 disabled:opacity-50"
            />
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

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="card p-4">
            <div className="text-xs opacity-70">Sales</div>
            <div className="text-2xl font-semibold">
              {peso(data?.totals.sales || 0)}
            </div>
          </div>

          <div className="card p-4">
            <div className="text-xs opacity-70">Expenses</div>
            <div className="text-2xl font-semibold">
              {peso(data?.totals.expenses || 0)}
            </div>
          </div>

          <div className="card p-4">
            <div className="text-xs opacity-70">Net (Sales − Expenses)</div>
            <div className="text-2xl font-semibold">
              {peso(data?.totals.net || 0)}
            </div>
          </div>
        </div>

        <div className="card p-4 space-y-4">
          <div className="text-sm font-medium">Daily Net</div>

          <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={net}
                margin={{ top: 6, right: 12, left: 60, bottom: 6 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis
                  tickFormatter={(v) => `₱${Number(v).toLocaleString()}`}
                  width={60}
                />
                <Tooltip
                  formatter={(value: number | string | undefined) =>
                    peso(Number(value ?? 0))
                  }
                />
                <Line
                  type="monotone"
                  dataKey="sales"
                  stroke="#22C55E"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="expenses"
                  stroke="#EF4444"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="net"
                  stroke="#6366F1"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="card p-4">
              <div className="text-sm font-medium mb-2">Sales by Category</div>
              <div className="w-full h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={salesCat}
                      dataKey="total"
                      nameKey="name"
                      innerRadius="60%"
                      outerRadius="90%"
                      stroke="none"
                    >
                      {salesCat.map((_, i) => (
                        <Cell
                          key={i}
                          fill={PALETTE[i % PALETTE.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number | string | undefined) =>
                        peso(Number(value ?? 0))
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card p-4">
              <div className="text-sm font-medium mb-2">
                Expenses by Category
              </div>
              <div className="w-full h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expCat}
                      dataKey="total"
                      nameKey="name"
                      innerRadius="60%"
                      outerRadius="90%"
                      stroke="none"
                    >
                      {expCat.map((_, i) => (
                        <Cell
                          key={i}
                          fill={PALETTE[(i + 3) % PALETTE.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number | string | undefined) =>
                        peso(Number(value ?? 0))
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card p-4">
              <div className="text-sm font-medium mb-2">
                Top-Selling Items (qty)
              </div>
              <div className="w-full h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={topItems}
                    margin={{ top: 6, right: 12, left: 12, bottom: 6 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      horizontal={false}
                    />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={160} />
                    <Tooltip
                      formatter={(value: number | string | undefined) =>
                        `${Number(value ?? 0)} pcs`
                      }
                    />
                    <Bar dataKey="qty" fill="#10B981">
                      <LabelList dataKey="qty" position="right" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {err && (
          <div className="p-3 text-sm" style={{ color: "#b10d0d" }}>
            {err}
          </div>
        )}
      </div>
    </Guard>
  );
}