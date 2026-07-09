"use client";

import { useEffect, useState } from "react";
import { SerieMensualChart } from "@/components/charts/serie-mensual-chart";

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
}

// Filtro de año propio del gráfico, independiente del filtro general de la
// página (que ya vino aplicado en `data`). Se resetea al rango completo
// cuando `data` cambia (ej. el usuario tocó el filtro general de la página).
export function SerieChartConFiltro({ data, ...chartProps }: Props) {
  const anios = Array.from(new Set(data.map((d) => d.anio))).sort((a, b) => a - b);
  const primero = anios[0];
  const ultimo = anios[anios.length - 1];
  const [desde, setDesde] = useState(primero);
  const [hasta, setHasta] = useState(ultimo);

  useEffect(() => {
    setDesde(primero);
    setHasta(ultimo);
  }, [primero, ultimo]);

  if (anios.length === 0) return <SerieMensualChart data={[]} {...chartProps} />;

  const filtrada = data.filter((d) => d.anio >= (desde ?? primero) && d.anio <= (hasta ?? ultimo));

  return (
    <div>
      <div className="flex items-center justify-end gap-1.5 mb-2">
        <select
          aria-label="Año desde"
          value={desde ?? primero}
          onChange={(e) => setDesde(Number(e.target.value))}
          className="text-xs rounded-md border border-border bg-background px-1.5 py-1 text-foreground"
        >
          {anios.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">–</span>
        <select
          aria-label="Año hasta"
          value={hasta ?? ultimo}
          onChange={(e) => setHasta(Number(e.target.value))}
          className="text-xs rounded-md border border-border bg-background px-1.5 py-1 text-foreground"
        >
          {anios.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>
      {/* Se conserva `anio` (no solo etiqueta/valor) -- lo usa SerieMensualChart
          para el insight reactivo al hover (delta interanual real, verificado
          por año, no asumido por la posición del punto en el arreglo). */}
      <SerieMensualChart data={filtrada} {...chartProps} />
    </div>
  );
}
