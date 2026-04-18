"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { useMemo } from "react";

type Row = {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  items?: { name: string; qty: number; price: number }[];
};

export default function SalesDonut({
  rows,
  title = "Revenue Streams",
  subtitle,
  wrap = "card",
  className,
}: {
  rows: Row[];
  title?: string;
  subtitle?: string;
  wrap?: "card" | "bare";
  className?: string;
}) {
  const palette = [
    "#22C55E",
    "#6366F1",
    "#06B6D4",
    "#F59E0B",
    "#EC4899",
    "#8B5CF6",
    "#0EA5E9",
    "#84CC16",
  ];

  const peso = (n: number) =>
    `₱${Number(n || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const { data, total } = useMemo(() => {
    const m = new Map<string, number>();

    rows.forEach((r) =>
      m.set(r.category, (m.get(r.category) || 0) + Number(r.amount || 0))
    );

    const arr = [...m.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    return { data: arr, total: arr.reduce((a, x) => a + x.value, 0) };
  }, [rows]);

  const header = (
    <div className="flex items-start justify-between mb-2">
      <div className="space-y-0.5">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted">{subtitle ?? "Current filters"}</div>
      </div>
    </div>
  );

  const body = (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-center">
      <div className="w-full h-64">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-muted">
            No sales in range.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius="60%"
                outerRadius="90%"
                stroke="none"
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={palette[i % palette.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number | string | undefined) => [
                  `₱${Number(value ?? 0).toLocaleString()}`,
                  "Amount",
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="space-y-3">
        <div className="rounded-xl ring-1 ring-[var(--border)] bg-white/70 p-4">
          <div className="text-xs opacity-70">This range total</div>
          <div className="text-2xl font-semibold break-words">{peso(total)}</div>
        </div>

        <div className="flex flex-wrap gap-2">
          {data.map((d, i) => (
            <span
              key={d.name}
              className="text-xs rounded-full px-2.5 py-1 ring-1 ring-[var(--border)] bg-white/70"
            >
              <span
                className="inline-block w-2 h-2 rounded-full mr-2 align-middle"
                style={{ background: palette[i % palette.length] }}
              />
              {d.name}: <span className="font-medium ml-1">{peso(d.value)}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );

  if (wrap === "bare") return <div className={className}>{header}{body}</div>;
  return <div className={`card p-4 ${className || ""}`}>{header}{body}</div>;
}