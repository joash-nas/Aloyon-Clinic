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
};

const peso = (n: number) =>
  `₱${Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// custom label renderer so the text is a real <text>, not stringified ReactNode
const ValueLabel: React.FC<any> = (p) => {
  const { x = 0, y = 0, width = 0, height = 0, value } = p;
  const txt = peso(Number(value || 0));

  return (
    <text
      x={x + width + 6}
      y={y + height / 2 + 4}
      fontSize={12}
      fill="#374151"
      textAnchor="start"
    >
      {txt}
    </text>
  );
};

export default function PaymentMethodBar({
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

    rows.forEach((r) =>
      m.set(
        r.paymentMethod || "Unknown",
        (m.get(r.paymentMethod || "Unknown") || 0) + Number(r.amount || 0)
      )
    );

    const arr = [...m.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    return arr.length ? arr : [{ name: "None", value: 0 }];
  }, [rows]);

  const Chart = (
    <div className={className}>
      <div className="text-sm font-medium mb-3">Payment Method Split</div>
      <div className="w-full h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={data}
            margin={{ top: 6, right: 12, left: 12, bottom: 6 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={(v) => `₱${Number(v).toLocaleString()}`}
            />
            <YAxis type="category" dataKey="name" width={110} />
            <Tooltip
              formatter={(value: number | string | undefined) =>
                peso(Number(value ?? 0))
              }
            />
            <Bar dataKey="value" fill="#10B981" radius={[6, 6, 6, 6]}>
              <LabelList dataKey="value" content={<ValueLabel />} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  return wrap === "bare" ? Chart : <div className="card p-4">{Chart}</div>;
}