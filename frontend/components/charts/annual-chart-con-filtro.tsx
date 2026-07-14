"use client";

import { CuotasStackedChart, type CuotasSerie } from "@/components/charts/cuotas-stacked-chart";
import { HhiChart } from "@/components/charts/hhi-chart";
import { EnvasesStackedChart, type EnvasesPunto } from "@/components/charts/envases-stacked-chart";
import { useZoomLocal, ZoomLocalControl } from "@/components/charts/zoom-local";

type Props =
  | { tipo: "cuotas"; data: Record<string, string | number>[]; series: CuotasSerie[] }
  | { tipo: "hhi"; data: { anio: string; hhi: number; coberturaPct: number }[] }
  | { tipo: "envases"; data: EnvasesPunto[] };

// `data` ya viene filtrada por el FilterBar global de la página -- esto es
// solo un zoom local opcional y subordinado (ver Fase 9, A3), no un
// segundo filtro primario.
export function AnnualChartConFiltro(props: Props) {
  const anios = Array.from(new Set(props.data.map((d) => Number(d.anio)))).sort((a, b) => a - b);
  const zoom = useZoomLocal(anios);
  const enRango = (anio: string | number) => zoom.enRango(anio);

  if (props.tipo === "cuotas") {
    return (
      <div>
        <ZoomLocalControl zoom={zoom} />
        <CuotasStackedChart data={props.data.filter((d) => enRango(d.anio))} series={props.series} />
      </div>
    );
  }
  if (props.tipo === "hhi") {
    return (
      <div>
        <ZoomLocalControl zoom={zoom} />
        <HhiChart data={props.data.filter((d) => enRango(d.anio))} />
      </div>
    );
  }
  return (
    <div>
      <ZoomLocalControl zoom={zoom} />
      <EnvasesStackedChart data={props.data.filter((d) => enRango(d.anio))} />
    </div>
  );
}
