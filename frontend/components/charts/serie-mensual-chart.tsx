"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

interface SerieMensualChartProps {
  data: { etiqueta: string; valor: number }[];
  color?: string;
  unidad?: string;
  formatValor?: (v: number) => string;
}

export function SerieMensualChart({ data, color = "#15803d", unidad, formatValor }: SerieMensualChartProps) {
  const formatear = formatValor ?? ((v: number) => new Intl.NumberFormat("es-AR").format(v));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#bbf7d0" vertical={false} />
        <XAxis
          dataKey="etiqueta"
          tick={{ fontSize: 12, fill: "#64748b" }}
          tickLine={false}
          axisLine={{ stroke: "#bbf7d0" }}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 12, fill: "#64748b" }}
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={(v) => formatear(v)}
        />
        <Tooltip
          formatter={(value: number) => [`${formatear(value)}${unidad ? ` ${unidad}` : ""}`, ""]}
          labelStyle={{ color: "#14532d", fontWeight: 600 }}
          contentStyle={{ borderRadius: 8, borderColor: "#bbf7d0" }}
        />
        <Line
          type="monotone"
          dataKey="valor"
          stroke={color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
