"use client";

import type { CapaCatalogo, GeoFeatureCollection } from "@/lib/types";
import { detalleFeature, resumirCapa } from "@/lib/gis-resumen";
import { KpiRow, PanelCard, RankingChart } from "@/components/mapa-kpi";

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
      <PanelCard titulo="Resumen de la capa" subtitulo={capa.descripcion}>
        {resumen.kpis.map((k) => (
          <KpiRow key={k.label} {...k} />
        ))}
      </PanelCard>

      {resumen.ranking.length > 0 && (
        <PanelCard titulo="Ranking" subtitulo={resumen.rankingLabel}>
          <RankingChart data={resumen.ranking} />
        </PanelCard>
      )}

      <PanelCard titulo="Zona seleccionada">
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
      </PanelCard>
    </div>
  );
}
