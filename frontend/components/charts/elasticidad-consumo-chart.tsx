"use client";

import { Bar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MultiSeriesTooltip } from "@/components/charts/multi-series-tooltip";
import { formatPct } from "@/lib/format";
import { GRID_COLOR, AXIS_TICK_STYLE, CHART_BLUE } from "@/components/charts/chart-theme";

export interface ElasticidadConsumoPunto {
  anio: string;
  "EMAE (actividad económica)": number;
  "Consumo interno (molino)": number;
}

// Barras agrupadas (no apiladas -- ambas series son variaciones % año a año,
// no partes de un todo, y pueden ser negativas). Ver hhi-chart/stacked-bar-chart
// para los otros 2 patrones de BarChart ya en uso.
export function ElasticidadConsumoChart({ data }: { data: ElasticidadConsumoPunto[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="anio" tick={AXIS_TICK_STYLE} tickLine={false} axisLine={{ stroke: GRID_COLOR }} />
        <YAxis tick={AXIS_TICK_STYLE} tickLine={false} axisLine={false} width={48} tickFormatter={formatPct} />
        <ReferenceLine y={0} stroke="var(--color-muted-foreground)" />
        <Tooltip content={<MultiSeriesTooltip formatter={formatPct} />} cursor={{ fill: "var(--color-primary)", fillOpacity: 0.06 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="EMAE (actividad económica)" fill={CHART_BLUE} radius={[3, 3, 0, 0]} maxBarSize={16} isAnimationActive={false} />
        <Bar dataKey="Consumo interno (molino)" fill="var(--color-primary)" radius={[3, 3, 0, 0]} maxBarSize={16} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
