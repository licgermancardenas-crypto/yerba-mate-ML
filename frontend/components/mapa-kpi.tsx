"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCompacto, formatNumero } from "@/lib/format";
import { GRID_COLOR, TICK_COLOR, AXIS_TICK_SIZE } from "@/components/charts/chart-theme";
import { abreviarNombreGeografico } from "@/lib/texto";

// Ciudades/departamentos largos ("Libertador General San Martín") se
// abrevian primero (ver Fase 9, C2) y recién si siguen sin entrar se
// truncan con elipsis en el tick del eje -- el nombre completo (sin
// abreviar) se ve igual en el tooltip al hacer hover, que no pasa por acá.
function truncarNombre(s: string, max = 20): string {
  const abreviado = abreviarNombreGeografico(s);
  return abreviado.length > max ? `${abreviado.slice(0, max - 1)}…` : abreviado;
}

// Bar chart horizontal reutilizado por los paneles laterales de Mapa GIS y
// Producción -- ranking (top-N) o desglose de una feature seleccionada.
export function RankingChart({ data, color = "var(--color-primary)" }: { data: { nombre: string; valor: number }[]; color?: string }) {
  if (data.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={Math.max(140, data.length * 26)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 4 }}>
        <CartesianGrid stroke={GRID_COLOR} horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: AXIS_TICK_SIZE, fill: TICK_COLOR }}
          tickLine={false}
          axisLine={{ stroke: GRID_COLOR }}
          tickFormatter={(v) => formatCompacto(Number(v))}
        />
        <YAxis
          type="category"
          dataKey="nombre"
          tick={{ fontSize: AXIS_TICK_SIZE, fill: TICK_COLOR }}
          tickLine={false}
          axisLine={false}
          width={150}
          tickFormatter={(v: string) => truncarNombre(v)}
        />
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
      <h3 className="text-[15px] font-semibold text-card-foreground mb-1">{titulo}</h3>
      {subtitulo && <p className="text-xs font-normal text-muted-foreground mb-2">{subtitulo}</p>}
      {children}
    </div>
  );
}
