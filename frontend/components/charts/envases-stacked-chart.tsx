"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MultiSeriesTooltip } from "@/components/charts/multi-series-tooltip";

const GRID_COLOR = "#e2e8e4";
const TICK_COLOR = "#64748b";

export interface EnvasesPunto {
  anio: string;
  "1/4 kg": number;
  "1/2 kg": number;
  "1 kg": number;
  "2 kg": number;
  Otros: number;
  "Sin estampilla": number;
}

// Paleta validada con scripts/validate_palette.js de la skill dataviz (CVD-safe,
// piso de croma, contraste >=3:1) — mantener este orden, la separación entre
// colores adyacentes depende de la secuencia exacta.
const SERIES: { key: keyof Omit<EnvasesPunto, "anio">; color: string }[] = [
  { key: "1/2 kg", color: "#15803d" },
  { key: "1 kg", color: "#1d4ed8" },
  { key: "2 kg", color: "#a16207" },
  { key: "1/4 kg", color: "#92400e" },
  { key: "Otros", color: "#7e22ce" },
  { key: "Sin estampilla", color: "#dc2626" },
];

export function EnvasesStackedChart({ data }: { data: EnvasesPunto[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="anio" tick={{ fontSize: 12, fill: TICK_COLOR }} tickLine={false} axisLine={{ stroke: GRID_COLOR }} />
        <YAxis
          tick={{ fontSize: 12, fill: TICK_COLOR }}
          tickLine={false}
          axisLine={false}
          width={40}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip content={<MultiSeriesTooltip />} cursor={{ fill: "#15803d", fillOpacity: 0.06 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {SERIES.map(({ key, color }, i) => (
          <Bar
            key={key}
            dataKey={key}
            stackId="envases"
            fill={color}
            stroke="#ffffff"
            strokeWidth={2}
            radius={i === SERIES.length - 1 ? [4, 4, 0, 0] : 0}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
