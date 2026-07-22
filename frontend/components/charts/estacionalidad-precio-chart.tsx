"use client";

import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatNumero } from "@/lib/format";
import { GRID_COLOR, AXIS_TICK_STYLE } from "@/components/charts/chart-theme";

interface EstacionalidadTooltipProps {
  active?: boolean;
  payload?: { payload?: { etiqueta: string; valor: number } }[];
}

function EstacionalidadTooltip({ active, payload }: EstacionalidadTooltipProps) {
  if (!active || !payload?.length) return null;
  const punto = payload[0]?.payload;
  if (!punto) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
      <div className="text-xs text-muted-foreground mb-0.5">{punto.etiqueta}</div>
      <div className="text-sm font-semibold tabular-nums text-card-foreground">Índice {formatNumero(punto.valor, 1)}</div>
    </div>
  );
}

// Índice de cada mes calendario contra el promedio de su propio año (100 =
// promedio anual) -- no una serie temporal, así que no usa SerieChartConFiltro.
export function EstacionalidadPrecioChart({ data }: { data: { etiqueta: string; valor: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="etiqueta" tick={AXIS_TICK_STYLE} tickLine={false} axisLine={{ stroke: GRID_COLOR }} />
        <YAxis tick={AXIS_TICK_STYLE} tickLine={false} axisLine={false} width={40} domain={["dataMin - 5", "dataMax + 5"]} />
        <ReferenceLine y={100} stroke="var(--color-muted-foreground)" strokeDasharray="4 4" />
        <Tooltip content={<EstacionalidadTooltip />} cursor={{ fill: "var(--color-primary)", fillOpacity: 0.06 }} />
        <Bar dataKey="valor" fill="var(--color-primary)" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
