"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

interface SerieMensualChartProps {
  data: { etiqueta: string; valor: number }[];
  color?: string;
  prefix?: string;
  suffix?: string;
  numberFormat?: Intl.NumberFormatOptions;
}

export function SerieMensualChart({ data, color = "#15803d", prefix = "", suffix = "", numberFormat }: SerieMensualChartProps) {
  const formatear = (v: number) => `${prefix}${new Intl.NumberFormat("es-AR", numberFormat).format(v)}${suffix}`;
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
          formatter={(value) => [formatear(Number(value)), ""]}
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
