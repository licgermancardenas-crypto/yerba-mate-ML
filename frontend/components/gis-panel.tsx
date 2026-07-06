"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CapaCatalogo, GeoFeatureCollection } from "@/lib/types";
import { detalleFeature, resumirCapa } from "@/lib/gis-resumen";
import { formatNumero } from "@/lib/format";

const GRID_COLOR = "#e2e8e4";
const TICK_COLOR = "#64748b";

function RankingChart({ data }: { data: { nombre: string; valor: number }[] }) {
  if (data.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={Math.max(140, data.length * 26)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID_COLOR} horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10, fill: TICK_COLOR }} tickLine={false} axisLine={{ stroke: GRID_COLOR }} />
        <YAxis type="category" dataKey="nombre" tick={{ fontSize: 11, fill: TICK_COLOR }} tickLine={false} axisLine={false} width={92} />
        <Tooltip cursor={{ fill: "#15803d", fillOpacity: 0.06 }} formatter={(v) => formatNumero(Number(v), 0)} />
        <Bar dataKey="valor" fill="#15803d" radius={[0, 4, 4, 0]} maxBarSize={16} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function KpiRow({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-border last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold tabular-nums text-card-foreground">{valor}</span>
    </div>
  );
}

export function GisPanel({
  capa,
  datos,
  featureSeleccionada,
}: {
  capa: CapaCatalogo;
  datos: GeoFeatureCollection;
  featureSeleccionada: Record<string, unknown> | null;
}) {
  const resumen = resumirCapa(capa, datos);
  const detalle = featureSeleccionada ? detalleFeature(capa, featureSeleccionada) : null;

  return (
    <div className="flex flex-col gap-4 lg:w-[340px] lg:shrink-0">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-card-foreground mb-1">Resumen de la capa</h3>
        <p className="text-xs text-muted-foreground mb-2">{capa.descripcion}</p>
        {resumen.kpis.map((k) => (
          <KpiRow key={k.label} {...k} />
        ))}
      </div>

      {resumen.ranking.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-card-foreground mb-1">Ranking</h3>
          <p className="text-xs text-muted-foreground mb-2">{resumen.rankingLabel}</p>
          <RankingChart data={resumen.ranking} />
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-card-foreground mb-2">Zona seleccionada</h3>
        {!detalle ? (
          <p className="text-xs text-muted-foreground">Hacé click en una zona del mapa para ver su detalle acá.</p>
        ) : (
          <>
            <div className="mb-2">
              <div className="text-sm font-semibold text-card-foreground">{detalle.titulo}</div>
              {detalle.subtitulo && <div className="text-xs text-muted-foreground">{detalle.subtitulo}</div>}
            </div>
            {detalle.kpis.map((k) => (
              <KpiRow key={k.label} {...k} />
            ))}
            {detalle.breakdown.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground mb-2">{detalle.breakdownLabel}</p>
                <RankingChart
                  data={[...detalle.breakdown]
                    .map((b) => ({ nombre: b.label, valor: b.valor }))
                    .sort((a, b) => b.valor - a.valor)
                    .slice(0, 10)}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
