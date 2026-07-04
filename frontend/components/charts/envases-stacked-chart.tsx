"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface EnvasesPunto {
  anio: string;
  "1/4 kg": number;
  "1/2 kg": number;
  "1 kg": number;
  "2 kg": number;
  Otros: number;
  "Sin estampilla": number;
}

const SERIES: { key: keyof Omit<EnvasesPunto, "anio">; color: string }[] = [
  { key: "1/2 kg", color: "#15803d" },
  { key: "1 kg", color: "#22c55e" },
  { key: "2 kg", color: "#a16207" },
  { key: "1/4 kg", color: "#65a30d" },
  { key: "Otros", color: "#94a3b8" },
  { key: "Sin estampilla", color: "#dc2626" },
];

export function EnvasesStackedChart({ data }: { data: EnvasesPunto[] }) {
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
          formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name]}
          contentStyle={{ borderRadius: 8, borderColor: "#bbf7d0" }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {SERIES.map(({ key, color }) => (
          <Bar key={key} dataKey={key} stackId="envases" fill={color} radius={0} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
