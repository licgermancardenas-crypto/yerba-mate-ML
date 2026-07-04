"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface CuotasSerie {
  key: string;
  color: string;
}

export function CuotasStackedChart({
  data,
  series,
}: {
  data: Record<string, string | number>[];
  series: CuotasSerie[];
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#bbf7d0" vertical={false} />
        <XAxis dataKey="anio" tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "#bbf7d0" }} />
        <YAxis
          tick={{ fontSize: 12, fill: "#64748b" }}
          tickLine={false}
          axisLine={false}
          width={40}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          formatter={(value, name) => [`${Number(value).toFixed(1)}%`, name]}
          contentStyle={{ borderRadius: 8, borderColor: "#bbf7d0" }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map(({ key, color }) => (
          <Bar key={key} dataKey={key} stackId="cuotas" fill={color} radius={0} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
