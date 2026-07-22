"use client";

import { Bar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MultiSeriesTooltip } from "@/components/charts/multi-series-tooltip";
import { formatPct } from "@/lib/format";
import { GRID_COLOR, AXIS_TICK_STYLE, CHART_BLUE } from "@/components/charts/chart-theme";

export interface GroupedBarPunto {
  etiqueta: string;
  [serie: string]: string | number;
}

// Barras agrupadas (no apiladas -- para pares de series que no son partes de
// un todo y pueden ser negativas, ej. 2 variaciones % comparadas lado a lado).
// Genérico desde el 2do consumidor real (EMAE/consumo interno en Cadena
// Productiva, REM/IPC yerba en Precios) -- ver hhi-chart/stacked-bar-chart
// para los otros 2 patrones de BarChart ya en uso, cada uno con su propia
// razón para no compartir este.
export function GroupedBarChart({
  data,
  serieA,
  serieB,
  formatter = formatPct,
}: {
  data: GroupedBarPunto[];
  serieA: { label: string; color?: string };
  serieB: { label: string; color?: string };
  formatter?: (v: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="etiqueta" tick={AXIS_TICK_STYLE} tickLine={false} axisLine={{ stroke: GRID_COLOR }} />
        <YAxis tick={AXIS_TICK_STYLE} tickLine={false} axisLine={false} width={48} tickFormatter={formatter} />
        <ReferenceLine y={0} stroke="var(--color-muted-foreground)" />
        <Tooltip content={<MultiSeriesTooltip formatter={formatter} />} cursor={{ fill: "var(--color-primary)", fillOpacity: 0.06 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey={serieA.label} fill={serieA.color ?? CHART_BLUE} radius={[3, 3, 0, 0]} maxBarSize={16} isAnimationActive={false} />
        <Bar dataKey={serieB.label} fill={serieB.color ?? "var(--color-primary)"} radius={[3, 3, 0, 0]} maxBarSize={16} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
