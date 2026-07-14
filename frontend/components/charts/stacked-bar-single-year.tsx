import type { StackedBarSerie } from "@/components/charts/stacked-bar-chart";

// Un stacked bar de UNA sola barra (un solo año en rango) no comunica nada
// -- se reemplaza por una barra horizontal 100% + leyenda con el valor
// exacto de cada serie (ver Fase 9, B5b). Vuelve al stacked multi-año en
// cuanto el zoom/filtro incluye 2+ años (ver AnnualChartConFiltro).
export function StackedBarSingleYear({
  data,
  series,
  formatter,
}: {
  data: Record<string, string | number>;
  series: StackedBarSerie[];
  formatter: (v: number) => string;
}) {
  const valores = series.map((s) => ({ ...s, valor: Number(data[s.key]) || 0 })).filter((s) => s.valor > 0);
  const total = valores.reduce((acc, s) => acc + s.valor, 0);

  if (valores.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 py-2">
      <div className="flex h-8 w-full overflow-hidden rounded-lg" role="img" aria-label={`Distribución ${data.anio}`}>
        {valores.map(({ key, color, valor }) => (
          <div
            key={key}
            style={{ width: `${total ? (valor / total) * 100 : 0}%`, backgroundColor: color }}
            title={`${key}: ${formatter(valor)}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
        {valores.map(({ key, color, valor }) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} aria-hidden="true" />
            <span className="text-card-foreground font-medium">{key}</span>
            <span className="text-muted-foreground tabular-nums">{formatter(valor)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
