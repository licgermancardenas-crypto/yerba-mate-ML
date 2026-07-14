"use client";

import { SerieMensualChart } from "@/components/charts/serie-mensual-chart";
import { useZoomLocal, ZoomLocalControl } from "@/components/charts/zoom-local";

export interface PuntoConAnio {
  anio: number;
  etiqueta: string;
  valor: number;
}

interface Props {
  data: PuntoConAnio[];
  color?: string;
  prefix?: string;
  suffix?: string;
  numberFormat?: Intl.NumberFormatOptions;
  /** Ver SerieMensualChartProps.estacional -- se pasa tal cual. */
  estacional?: boolean;
}

// `data` ya viene filtrada por el FilterBar global de la página -- esto es
// solo un zoom local opcional y subordinado (ver Fase 9, A3), no un
// segundo filtro primario.
export function SerieChartConFiltro({ data, ...chartProps }: Props) {
  const anios = Array.from(new Set(data.map((d) => d.anio))).sort((a, b) => a - b);
  const zoom = useZoomLocal(anios);

  if (anios.length === 0) return <SerieMensualChart data={[]} {...chartProps} />;

  const filtrada = data.filter((d) => zoom.enRango(d.anio));

  return (
    <div>
      <ZoomLocalControl zoom={zoom} />
      {/* Se conserva `anio` (no solo etiqueta/valor) -- lo usa SerieMensualChart
          para el insight reactivo al hover (delta interanual real, verificado
          por año, no asumido por la posición del punto en el arreglo). */}
      <SerieMensualChart data={filtrada} {...chartProps} />
    </div>
  );
}
