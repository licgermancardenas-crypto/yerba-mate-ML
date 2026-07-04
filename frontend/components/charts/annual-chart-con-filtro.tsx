"use client";

import { useEffect, useState } from "react";
import { CuotasStackedChart, type CuotasSerie } from "@/components/charts/cuotas-stacked-chart";
import { HhiChart } from "@/components/charts/hhi-chart";
import { EnvasesStackedChart, type EnvasesPunto } from "@/components/charts/envases-stacked-chart";

type Props =
  | { tipo: "cuotas"; data: Record<string, string | number>[]; series: CuotasSerie[] }
  | { tipo: "hhi"; data: { anio: string; hhi: number; coberturaPct: number }[] }
  | { tipo: "envases"; data: EnvasesPunto[] };

// Filtro de año propio del gráfico (barras anuales), independiente del
// filtro general de la página. Se resetea al rango completo cuando `data`
// cambia (ej. el usuario tocó el filtro general de la página).
export function AnnualChartConFiltro(props: Props) {
  const anios = Array.from(new Set(props.data.map((d) => Number(d.anio)))).sort((a, b) => a - b);
  const primero = anios[0];
  const ultimo = anios[anios.length - 1];
  const [desde, setDesde] = useState(primero);
  const [hasta, setHasta] = useState(ultimo);

  useEffect(() => {
    setDesde(primero);
    setHasta(ultimo);
  }, [primero, ultimo]);

  const dLo = desde ?? primero;
  const dHi = hasta ?? ultimo;
  const enRango = (anio: string | number) => Number(anio) >= dLo && Number(anio) <= dHi;

  const selector = anios.length > 0 && (
    <div className="flex items-center justify-end gap-1.5 mb-2">
      <select
        aria-label="Año desde"
        value={dLo}
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
        value={dHi}
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
  );

  if (props.tipo === "cuotas") {
    return (
      <div>
        {selector}
        <CuotasStackedChart data={props.data.filter((d) => enRango(d.anio))} series={props.series} />
      </div>
    );
  }
  if (props.tipo === "hhi") {
    return (
      <div>
        {selector}
        <HhiChart data={props.data.filter((d) => enRango(d.anio))} />
      </div>
    );
  }
  return (
    <div>
      {selector}
      <EnvasesStackedChart data={props.data.filter((d) => enRango(d.anio))} />
    </div>
  );
}
