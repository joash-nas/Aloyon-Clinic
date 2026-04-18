"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LabelList,
} from "recharts";
import { useMemo } from "react";
import React from "react";

type Row = {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  items?: { name: string; qty: number; price: number }[];
};

// label renderer to show qty
const QtyLabel: React.FC<any> = (p) => {
  const { x = 0, y = 0, width = 0, height = 0, value } = p;
  return (
    <text x={x + width + 6} y={y + height / 2 + 4} fontSize={12} fill="#374151">
      {value}
    </text>
  );
};

export default function TopItemsBar({
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
      (r.items || []).forEach((it) => {
        const key = String(it.name || "Unknown");
        m.set(key, (m.get(key) || 0) + Number(it.qty || 0));
      });
    });

    const arr = [...m.entries()]
      .map(([name, qty]) => ({ name, qty }))
      .filter((x) => x.qty > 0)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);

    return arr.length ? arr : [{ name: "—", qty: 0 }];
  }, [rows]);

  const Chart = (
    <div className={className}>
      <div className="text-sm font-medium mb-3">Top-Selling Items (qty)</div>
      <div className="w-full h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={data}
            margin={{ top: 6, right: 12, left: 12, bottom: 6 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={160} />
            <Tooltip
              formatter={(value: number | string | undefined) =>
                `${Number(value ?? 0)} pcs`
              }
            />
            <Bar dataKey="qty" fill="#22C55E" radius={[6, 6, 6, 6]}>
              <LabelList dataKey="qty" content={<QtyLabel />} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  return wrap === "bare" ? Chart : <div className="card p-4">{Chart}</div>;
}