"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MultiSeriesTooltip } from "@/components/charts/multi-series-tooltip";
import { GRID_COLOR, AXIS_TICK_STYLE } from "@/components/charts/chart-theme";

export interface StackedBarSerie {
  key: string;
  color: string;
}

interface StackedBarChartProps {
  data: Record<string, string | number>[];
  series: StackedBarSerie[];
  /** [0, 100] para series de % (fijo, ver Fase 9 B5 -- antes cada chart de %
   * definía su propio domain, y uno de los dos se desincronizó del otro).
   * Omitido (auto) para series en unidades absolutas (kg, etc.). */
  domain?: [number, number];
  /** Formatea el eje Y y el tooltip -- kg pasa formatMasa/formatCompacto,
   * % pasa formatPct (ver Fase 9 B1: el bug real de "Salida de molino por
   * año" era usar un formatter/domain de % sobre datos en kilogramos). */
  formatter: (v: number) => string;
}

// Único stacked bar chart de la app (ver Fase 9, B1) -- antes
// CuotasStackedChart (Competencia) y EnvasesStackedChart (Consumo) eran
// casi duplicados byte a byte, y Cadena Productiva reusaba el de Competencia
// (asumiendo domain 0-100 y sufijo "%") para datos en kilogramos.
export function StackedBarChart({ data, series, domain, formatter }: StackedBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="anio" tick={AXIS_TICK_STYLE} tickLine={false} axisLine={{ stroke: GRID_COLOR }} />
        <YAxis
          tick={AXIS_TICK_STYLE}
          tickLine={false}
          axisLine={false}
          width={domain ? 40 : 56}
          domain={domain}
          tickFormatter={formatter}
        />
        <Tooltip content={<MultiSeriesTooltip formatter={formatter} />} cursor={{ fill: "#15803d", fillOpacity: 0.06 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map(({ key, color }, i) => (
          <Bar
            key={key}
            dataKey={key}
            stackId="stack"
            fill={color}
            stroke="#ffffff"
            strokeWidth={2}
            radius={i === series.length - 1 ? [4, 4, 0, 0] : 0}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
