import { Coffee, Package, ScrollText } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { NoData } from "@/components/no-data";
import { GaugeCard } from "@/components/gauge-card";
import { ChartCard } from "@/components/chart-card";
import { FilterBar } from "@/components/filter-bar";
import { FooterFuentes } from "@/components/footer-fuentes";
import { SerieChartConFiltro } from "@/components/charts/serie-chart-con-filtro";
import { AnnualChartConFiltro } from "@/components/charts/annual-chart-con-filtro";
import type { EnvasesPunto } from "@/components/charts/annual-chart-con-filtro";
import { HistoricalTable } from "@/components/historical-table";
import { Sparkline } from "@/components/charts/sparkline";
import { DeltaBadge } from "@/components/delta-badge";
import type { ColumnaTabla } from "@/components/data-table";
import { formatNumero } from "@/lib/format";
import { getConsumo } from "@/lib/api";
import { agregarConsumoAnual, type ConsumoAnualRow } from "@/lib/agregaciones";
import type { ConsumoRow } from "@/lib/types";

const COLUMNAS_ANUAL: ColumnaTabla<ConsumoAnualRow>[] = [
  { key: "anio", label: "Año", align: "left" },
  { key: "consumo_per_capita_kg", label: "Per cápita (kg)", align: "right", format: "decimal2" },
  { key: "envase_05kg_pct", label: "1/2 kg (%)", align: "right", format: "porcentaje" },
  { key: "envase_1kg_pct", label: "1 kg (%)", align: "right", format: "porcentaje" },
  { key: "envase_025kg_pct", label: "1/4 kg (%)", align: "right", format: "porcentaje" },
  { key: "envase_2kg_pct", label: "2 kg (%)", align: "right", format: "porcentaje" },
  { key: "otros_envases_pct", label: "Otros (%)", align: "right", format: "porcentaje" },
  { key: "sin_estampillas_pct", label: "Sin estampilla (%)", align: "right", format: "porcentaje" },
];

const COLUMNAS_MENSUAL: ColumnaTabla<ConsumoRow>[] = [
  { key: "anio", label: "Año", align: "left" },
  { key: "mes_nombre", label: "Mes", align: "left" },
  { key: "consumo_per_capita_kg", label: "Per cápita (kg)", align: "right", format: "decimal2" },
  { key: "envase_05kg_pct", label: "1/2 kg (%)", align: "right", format: "porcentaje" },
  { key: "envase_1kg_pct", label: "1 kg (%)", align: "right", format: "porcentaje" },
  { key: "envase_025kg_pct", label: "1/4 kg (%)", align: "right", format: "porcentaje" },
  { key: "envase_2kg_pct", label: "2 kg (%)", align: "right", format: "porcentaje" },
  { key: "otros_envases_pct", label: "Otros (%)", align: "right", format: "porcentaje" },
  { key: "sin_estampillas_pct", label: "Sin estampilla (%)", align: "right", format: "porcentaje" },
];

export default async function ConsumoPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const anioDesde = Number(sp.anio_desde) || undefined;
  const anioHasta = Number(sp.anio_hasta) || undefined;

  const filasCompletas = await getConsumo();
  const todosLosAnios = Array.from(new Set(filasCompletas.map((f) => f.anio))).sort((a, b) => a - b);

  const filas = filasCompletas.filter(
    (f) => (!anioDesde || f.anio >= anioDesde) && (!anioHasta || f.anio <= anioHasta)
  );

  const porAnio = new Map<number, (typeof filas)[number]>();
  for (const fila of filas) {
    if (!porAnio.has(fila.anio)) porAnio.set(fila.anio, fila);
  }
  const anios = Array.from(porAnio.keys()).sort();

  const serieAnual = anios.map((anio) => ({
    anio,
    etiqueta: String(anio),
    valor: porAnio.get(anio)!.consumo_per_capita_kg,
  }));

  // AUDITORÍA 2026-07-11: mix de envases 2011-2024 estaba congelado idéntico
  // (fabricado, ver docs/auditoria_datos.md) y se anuló -- se excluyen esos
  // años del chart en vez de graficar un 0% engañoso.
  const envasesPorAnio: EnvasesPunto[] = anios
    .map((anio) => porAnio.get(anio)!)
    .filter(
      (f): f is typeof f & { envase_025kg_pct: number; envase_05kg_pct: number; envase_1kg_pct: number; envase_2kg_pct: number; otros_envases_pct: number; sin_estampillas_pct: number } =>
        f.envase_025kg_pct != null &&
        f.envase_05kg_pct != null &&
        f.envase_1kg_pct != null &&
        f.envase_2kg_pct != null &&
        f.otros_envases_pct != null &&
        f.sin_estampillas_pct != null
    )
    .map((f) => ({
      anio: String(f.anio),
      "1/4 kg": f.envase_025kg_pct,
      "1/2 kg": f.envase_05kg_pct,
      "1 kg": f.envase_1kg_pct,
      "2 kg": f.envase_2kg_pct,
      Otros: f.otros_envases_pct,
      "Sin estampilla": f.sin_estampillas_pct,
    }));

  const ultimoAnio = anios[anios.length - 1];
  const penultimoAnio = anios[anios.length - 2];
  const consumoUltimo = ultimoAnio !== undefined ? porAnio.get(ultimoAnio)!.consumo_per_capita_kg : undefined;
  const consumoPenultimo = penultimoAnio !== undefined ? porAnio.get(penultimoAnio)?.consumo_per_capita_kg : undefined;
  const deltaConsumo =
    consumoUltimo !== undefined && consumoPenultimo ? ((consumoUltimo - consumoPenultimo) / consumoPenultimo) * 100 : undefined;

  const filaUltimoAnio = ultimoAnio !== undefined ? porAnio.get(ultimoAnio) : undefined;
  const envasesConLabel: [string, number][] = filaUltimoAnio
    ? (
        [
          ["1/4 kg", filaUltimoAnio.envase_025kg_pct],
          ["1/2 kg", filaUltimoAnio.envase_05kg_pct],
          ["1 kg", filaUltimoAnio.envase_1kg_pct],
          ["2 kg", filaUltimoAnio.envase_2kg_pct],
        ] as [string, number | null][]
      ).filter((par): par is [string, number] => par[1] != null)
    : [];
  const formatoPreferido = envasesConLabel.length
    ? envasesConLabel.reduce((max, actual) => (actual[1] > max[1] ? actual : max))[0]
    : null;

  const anualHistorico = agregarConsumoAnual(filas);
  const mensualHistorico = [...filas].sort((a, b) => b.anio - a.anio || b.mes - a.mes);

  return (
    <main className="p-6 md:p-8">
      <PageHeader
        title="Consumo"
        description="Consumo per cápita y mix de envases en el mercado interno."
      />

      <FilterBar anios={todosLosAnios} />

      {filas.length === 0 || !filaUltimoAnio ? (
        <NoData variant="chart" motivo="Sin datos para los filtros seleccionados." />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <KpiCard
              label={`Consumo per cápita ${ultimoAnio}`}
              value={`${formatNumero(consumoUltimo!, 2)} kg/persona`}
              icon={Coffee}
              deltaPct={deltaConsumo}
              deltaLabel={`vs. ${penultimoAnio}`}
              destacado
            />
            <KpiCard
              label="Formato preferido"
              value={formatoPreferido ?? <NoData variant="kpi" />}
              icon={Package}
            />
            {filaUltimoAnio.sin_estampillas_pct != null && (
              <GaugeCard
                label="Sin estampilla"
                valorPct={filaUltimoAnio.sin_estampillas_pct}
                icon={ScrollText}
                color="var(--color-accent)"
              />
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <ChartCard title="Consumo per cápita por año" description="Kilogramos por persona por año">
              <SerieChartConFiltro
                data={serieAnual}
                numberFormat={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }}
                suffix=" kg"
              />
            </ChartCard>

            <ChartCard title="Mix de envases por año" description="% de las salidas de molino al mercado interno">
              <AnnualChartConFiltro tipo="envases" data={envasesPorAnio} />
            </ChartCard>
          </div>

          <ChartCard
            title="Histórico completo"
            className="mt-4"
            description={
              <>
                Desde {anualHistorico[anualHistorico.length - 1]?.anio} hasta {ultimoAnio}. La fuente publica el mismo valor los 12 meses de cada año (cadencia de publicación anual, no mensual).
              </>
            }
          >
            <HistoricalTable
              columnasAnual={COLUMNAS_ANUAL}
              filasAnual={anualHistorico}
              columnasMensual={COLUMNAS_MENSUAL}
              filasMensual={mensualHistorico}
            />
          </ChartCard>

          <ChartCard
            title="Consumo per cápita — tendencia"
            className="mt-4"
            description="La fuente publica el mismo valor los 12 meses de cada año (cadencia anual, no mensual) -- una matriz de 12 columnas idénticas por fila no aporta lectura, solo la tendencia entre años."
          >
            <div className="flex items-center gap-4">
              <Sparkline valores={[...anualHistorico].reverse().map((f) => f.consumo_per_capita_kg)} />
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold tabular-nums text-card-foreground">
                  {formatNumero(anualHistorico[0]?.consumo_per_capita_kg ?? 0, 2)} kg/persona ({ultimoAnio})
                </span>
                <DeltaBadge valor={deltaConsumo} base={`vs. ${penultimoAnio}`} />
              </div>
            </div>
          </ChartCard>
        </>
      )}

      <FooterFuentes tablas={["ym.consumo_interno"]} />
    </main>
  );
}
