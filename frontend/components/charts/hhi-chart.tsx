"use client";

import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { HHI_UMBRAL_ALTO, HHI_UMBRAL_MODERADO } from "@/lib/metricas-competencia";
import { formatPct } from "@/lib/format";

const GRID_COLOR = "#e2e8e4";
const TICK_COLOR = "#64748b";

interface HhiTooltipProps {
  active?: boolean;
  payload?: { payload?: { anio: string; hhi: number; coberturaPct: number } }[];
}

function HhiTooltip({ active, payload }: HhiTooltipProps) {
  if (!active || !payload?.length) return null;
  const punto = payload[0]?.payload;
  if (!punto) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
      <div className="text-xs text-muted-foreground mb-0.5">{punto.anio}</div>
      <div className="text-sm font-semibold tabular-nums text-card-foreground">HHI {Math.round(punto.hhi)}</div>
      <div className="text-xs text-muted-foreground">Cobertura: {formatPct(punto.coberturaPct)} del mercado</div>
    </div>
  );
}

export function HhiChart({ data }: { data: { anio: string; hhi: number; coberturaPct: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="anio" tick={{ fontSize: 12, fill: TICK_COLOR }} tickLine={false} axisLine={{ stroke: GRID_COLOR }} />
        <YAxis tick={{ fontSize: 12, fill: TICK_COLOR }} tickLine={false} axisLine={false} width={50} domain={[0, 10000]} />
        <ReferenceLine
          y={HHI_UMBRAL_MODERADO}
          stroke="#a16207"
          strokeDasharray="4 4"
          label={{ value: "1500", position: "right", fontSize: 11, fill: "#a16207" }}
        />
        <ReferenceLine
          y={HHI_UMBRAL_ALTO}
          stroke="#dc2626"
          strokeDasharray="4 4"
          label={{ value: "2500", position: "right", fontSize: 11, fill: "#dc2626" }}
        />
        <Tooltip content={<HhiTooltip />} cursor={{ fill: "#15803d", fillOpacity: 0.06 }} />
        <Bar dataKey="hhi" fill="#15803d" radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
