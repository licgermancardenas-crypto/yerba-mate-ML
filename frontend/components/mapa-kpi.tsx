"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatNumero } from "@/lib/format";

const GRID_COLOR = "#e2e8e4";
const TICK_COLOR = "#64748b";

// Bar chart horizontal reutilizado por los paneles laterales de Mapa GIS y
// Producción -- ranking (top-N) o desglose de una feature seleccionada.
export function RankingChart({ data, color = "#15803d" }: { data: { nombre: string; valor: number }[]; color?: string }) {
  if (data.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={Math.max(140, data.length * 26)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID_COLOR} horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10, fill: TICK_COLOR }} tickLine={false} axisLine={{ stroke: GRID_COLOR }} />
        <YAxis type="category" dataKey="nombre" tick={{ fontSize: 11, fill: TICK_COLOR }} tickLine={false} axisLine={false} width={92} />
        <Tooltip cursor={{ fill: color, fillOpacity: 0.06 }} formatter={(v) => formatNumero(Number(v), 0)} />
        <Bar dataKey="valor" fill={color} radius={[0, 4, 4, 0]} maxBarSize={16} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function KpiRow({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-border last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold tabular-nums text-card-foreground">{valor}</span>
    </div>
  );
}

export function PanelCard({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-card-foreground mb-1">{titulo}</h3>
      {subtitulo && <p className="text-xs text-muted-foreground mb-2">{subtitulo}</p>}
      {children}
    </div>
  );
}
