"use client";

import { StackedBarChart, type StackedBarSerie } from "@/components/charts/stacked-bar-chart";
import { StackedBarSingleYear } from "@/components/charts/stacked-bar-single-year";
import { HhiChart } from "@/components/charts/hhi-chart";
import { useZoomLocal, ZoomLocalControl } from "@/components/charts/zoom-local";
import { formatMasa, formatMasaCompacta, formatPct, type UnidadMasa } from "@/lib/format";

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
const ENVASES_SERIES: StackedBarSerie[] = [
  { key: "1/2 kg", color: "#15803d" },
  { key: "1 kg", color: "#1d4ed8" },
  { key: "2 kg", color: "#a16207" },
  { key: "1/4 kg", color: "#92400e" },
  { key: "Otros", color: "#7e22ce" },
  { key: "Sin estampilla", color: "#dc2626" },
];

type Props =
  | { tipo: "cuotas"; data: Record<string, string | number>[]; series: StackedBarSerie[] }
  | { tipo: "hhi"; data: { anio: string; hhi: number; coberturaPct: number }[] }
  | { tipo: "envases"; data: EnvasesPunto[] }
  // Ver Fase 9, B1: antes "Salida de molino por año" (kilogramos) reusaba
  // tipo="cuotas" (pensado para %, domain 0-100) -- de ahí el eje mostrando
  // "1148%"/"000%". Este modo usa unidades absolutas (kg/t), sin clamp.
  | { tipo: "masa"; data: Record<string, string | number>[]; series: StackedBarSerie[]; unidad: UnidadMasa };

// `data` ya viene filtrada por el FilterBar global de la página -- esto es
// solo un zoom local opcional y subordinado (ver Fase 9, A3), no un
// segundo filtro primario.
export function AnnualChartConFiltro(props: Props) {
  const anios = Array.from(new Set(props.data.map((d) => Number(d.anio)))).sort((a, b) => a - b);
  const zoom = useZoomLocal(anios);
  const enRango = (anio: string | number) => zoom.enRango(anio);
  // Un solo año en rango: un stacked de una barra no comunica nada (ver
  // Fase 9, B5b) -- se reemplaza por barra horizontal 100% + leyenda.
  const unAnio = zoom.desde === zoom.hasta;

  if (props.tipo === "hhi") {
    return (
      <div>
        <ZoomLocalControl zoom={zoom} />
        <HhiChart data={props.data.filter((d) => enRango(d.anio))} />
      </div>
    );
  }

  if (props.tipo === "cuotas") {
    const filtrada = props.data.filter((d) => enRango(d.anio));
    return (
      <div>
        <ZoomLocalControl zoom={zoom} />
        {unAnio && filtrada[0] ? (
          <StackedBarSingleYear data={filtrada[0]} series={props.series} formatter={formatPct} />
        ) : (
          <StackedBarChart data={filtrada} series={props.series} domain={[0, 100]} formatter={formatPct} />
        )}
      </div>
    );
  }

  if (props.tipo === "envases") {
    // EnvasesPunto es una interfaz de claves fijas (sin index signature) --
    // StackedBarChart/StackedBarSingleYear son genéricos para cualquier
    // stacked (cuotas, envases, kg), así que necesitan un Record real.
    const filtrada: Record<string, string | number>[] = props.data.filter((d) => enRango(d.anio)).map((d) => ({ ...d }));
    return (
      <div>
        <ZoomLocalControl zoom={zoom} />
        {unAnio && filtrada[0] ? (
          <StackedBarSingleYear data={filtrada[0]} series={ENVASES_SERIES} formatter={formatPct} />
        ) : (
          <StackedBarChart data={filtrada} series={ENVASES_SERIES} domain={[0, 100]} formatter={formatPct} />
        )}
      </div>
    );
  }

  // tipo === "masa"
  const filtrada = props.data.filter((d) => enRango(d.anio));
  const formatearMasa = (v: number) => formatMasaCompacta(v, props.unidad);
  return (
    <div>
      <ZoomLocalControl zoom={zoom} />
      {unAnio && filtrada[0] ? (
        <StackedBarSingleYear data={filtrada[0]} series={props.series} formatter={(v) => formatMasa(v, props.unidad)} />
      ) : (
        <StackedBarChart data={filtrada} series={props.series} formatter={formatearMasa} />
      )}
    </div>
  );
}
