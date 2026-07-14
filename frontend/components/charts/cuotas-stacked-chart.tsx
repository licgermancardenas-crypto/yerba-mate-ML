"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MultiSeriesTooltip } from "@/components/charts/multi-series-tooltip";
import { GRID_COLOR, AXIS_TICK_STYLE } from "@/components/charts/chart-theme";
import { formatPct } from "@/lib/format";

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
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="anio" tick={AXIS_TICK_STYLE} tickLine={false} axisLine={{ stroke: GRID_COLOR }} />
        <YAxis
          tick={AXIS_TICK_STYLE}
          tickLine={false}
          axisLine={false}
          width={40}
          domain={[0, 100]}
          tickFormatter={(v) => formatPct(v)}
        />
        <Tooltip content={<MultiSeriesTooltip />} cursor={{ fill: "#15803d", fillOpacity: 0.06 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map(({ key, color }, i) => (
          <Bar
            key={key}
            dataKey={key}
            stackId="cuotas"
            fill={color}
            stroke="#ffffff"
            strokeWidth={2}
            radius={i === series.length - 1 ? [4, 4, 0, 0] : 0}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
