"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useMemo } from "react";

type Row = {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
};

const peso = (n: number) =>
  `₱${Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function DailyTotalsBar({
  rows,
  wrap = "card",
  className,
}: {
  rows: Row[];
  wrap?: "card" | "bare";
  className?: string;
}) {
  const data = useMemo(() => {
    const m = new Map<string, number>();

    rows.forEach((r) => {
      const d = new Date(r.date);
      if (!isNaN(+d)) {
        const key = d.toLocaleDateString();
        m.set(key, (m.get(key) || 0) + Number(r.amount || 0));
      }
    });

    const arr = [...m.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => +new Date(a.label) - +new Date(b.label));

    return arr.length ? arr : [{ label: "No data", value: 0 }];
  }, [rows]);

  const Chart = (
    <div className={className}>
      <div className="text-sm font-medium mb-3">Daily Totals</div>
      <div className="w-full h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 6, right: 12, left: 60, bottom: 6 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis
              width={54}
              tickMargin={6}
              tickFormatter={(v) => `₱${Number(v).toLocaleString()}`}
            />
            <Tooltip
              formatter={(value: number | string | undefined) =>
                peso(Number(value ?? 0))
              }
            />
            <Bar dataKey="value" fill="#2563EB" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  return wrap === "bare" ? Chart : <div className="card p-4">{Chart}</div>;
}