import { Package, Ship, Globe2, Gauge, ArrowRightLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { NoData } from "@/components/no-data";
import { GaugeCard } from "@/components/gauge-card";
import { ChartCard } from "@/components/chart-card";
import { FilterBar } from "@/components/filter-bar";
import { FooterFuentes } from "@/components/footer-fuentes";
import { SerieChartConFiltro } from "@/components/charts/serie-chart-con-filtro";
import { AnnualChartConFiltro } from "@/components/charts/annual-chart-con-filtro";
import { CHART_BLUE } from "@/components/charts/chart-theme";
import { HistoricalTable } from "@/components/historical-table";
import { HeatmapTable, type HeatmapTableSerie } from "@/components/heatmap-table";
import type { ColumnaTabla } from "@/components/data-table";
import { esAnioCompleto, formatMasa, formatMasaCompacta, formatNumero, formatPct, type UnidadMasa } from "@/lib/format";
import { getExportacionesAnualReal, getExportacionesIndec, getImportacionesIndec } from "@/lib/api";
import {
  agregarComexIndecAnualNacional,
  agregarComexIndecMensualNacional,
  agregarComexIndecMensualHistorico,
  agregarComexIndecPorPais,
  type ComexAnualRow,
  type ComexIndecMensualNacionalRow,
} from "@/lib/agregaciones";
import { calcularConcentracion } from "@/lib/metricas-competencia";

const COBERTURA_MINIMA_CHART_HHI = 50;

/** Precio FOB promedio nacional por año, a partir de filas crudas INDEC
 * (importación o exportación, misma forma). Reusado para el spread de
 * abajo -- no se agrega a agregaciones.ts porque solo esta página lo usa. */
function precioFobPorAnio(filas: { anio: number; peso_kg: number | null; monto_fob_usd: number | null }[]): Map<number, number> {
  const porAnio = new Map<number, { kg: number; usd: number }>();
  for (const f of filas) {
    if (f.peso_kg == null) continue;
    const acc = porAnio.get(f.anio) ?? { kg: 0, usd: 0 };
    acc.kg += f.peso_kg;
    acc.usd += f.monto_fob_usd ?? 0;
    porAnio.set(f.anio, acc);
  }
  const resultado = new Map<number, number>();
  for (const [anio, { kg, usd }] of porAnio) {
    if (kg > 0) resultado.set(anio, usd / kg);
  }
  return resultado;
}

const COLUMNAS_ANUAL: ColumnaTabla<ComexAnualRow>[] = [
  { key: "anio", label: "Año", align: "left" },
  { key: "volumen_kg", label: "Volumen (kg)", align: "right", format: "entero" },
];

const COLUMNAS_MENSUAL: ColumnaTabla<ComexIndecMensualNacionalRow>[] = [
  { key: "anio", label: "Año", align: "left" },
  { key: "mes_nombre", label: "Mes", align: "left" },
  { key: "volumen_kg", label: "Volumen (kg)", align: "right", format: "entero" },
];

export default async function ImportacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const anioDesde = Number(sp.anio_desde) || undefined;
  const anioHasta = Number(sp.anio_hasta) || undefined;
  const origenFiltro = typeof sp.origen === "string" ? sp.origen : undefined;
  const unidad: UnidadMasa = sp.unidad === "t" ? "t" : "kg";
  const sufijoUnidad = unidad === "t" ? " t" : " kg";
  const factorUnidad = unidad === "t" ? 1 / 1000 : 1;

  const [indecCompleta, exportacionesAnualReal, exportacionesIndecCompleta] = await Promise.all([
    getImportacionesIndec(),
    getExportacionesAnualReal(),
    getExportacionesIndec(),
  ]);
  const todosLosAnios = Array.from(new Set(indecCompleta.map((f) => f.anio))).sort((a, b) => a - b);
  const todosLosOrigenes = Array.from(new Set(indecCompleta.map((f) => f.pais_nombre))).filter((n) => n !== "Confidencial").sort();

  const filas = indecCompleta.filter(
    (f) =>
      (!anioDesde || f.anio >= anioDesde) &&
      (!anioHasta || f.anio <= anioHasta) &&
      (!origenFiltro || f.pais_nombre === origenFiltro)
  );

  if (filas.length === 0) {
    return (
      <main className="p-6 md:p-8">
        <PageHeader title="Importaciones" description="Volumen mensual importado, por país de origen." />
        <FilterBar anios={todosLosAnios} dimension={{ param: "origen", label: "Origen", opciones: todosLosOrigenes }} mostrarUnidad />
        <NoData variant="chart" motivo="Sin datos para los filtros seleccionados." />
      </main>
    );
  }

  const anios = Array.from(new Set(filas.map((f) => f.anio))).sort((a, b) => a - b);
  const ultimoAnio = anios[anios.length - 1];
  const penultimoAnio = anios[anios.length - 2];

  const anualHistorico = agregarComexIndecAnualNacional(filas);
  const mensualHistorico = agregarComexIndecMensualHistorico(filas);
  const serieMensual = agregarComexIndecMensualNacional(filas);
  const origenesDelAnio = agregarComexIndecPorPais(indecCompleta, ultimoAnio);
  const pctConOrigen = origenesDelAnio.reduce((acc, d) => acc + d.porcentaje, 0);

  const importadoUltimo = anualHistorico.find((f) => f.anio === ultimoAnio)?.volumen_kg ?? null;
  const importadoPenultimo = anualHistorico.find((f) => f.anio === penultimoAnio)?.volumen_kg ?? null;
  // Año en curso casi nunca tiene los 12 meses publicados -- comparar su total
  // parcial contra el año anterior COMPLETO da una caída falsa enorme.
  const deltaImportado =
    importadoUltimo != null && importadoPenultimo && ultimoAnio !== undefined && esAnioCompleto(ultimoAnio)
      ? ((importadoUltimo - importadoPenultimo) / importadoPenultimo) * 100
      : undefined;

  const exportadoUltimoNacional = exportacionesAnualReal.find((f) => f.destino === "(nacional)" && f.anio === ultimoAnio);
  const exportadoUltimo =
    exportadoUltimoNacional?.volumen_kg ??
    exportacionesAnualReal
      .filter((f) => f.anio === ultimoAnio && f.destino !== "(nacional)")
      .reduce((acc, f) => acc + (f.volumen_kg ?? 0), 0);
  const balanzaUltimo = exportadoUltimo != null && importadoUltimo != null ? exportadoUltimo - importadoUltimo : null;

  // Concentración de orígenes (HHI) -- mismo cálculo que ya usa /competencia
  // (empresas) y /exportaciones (destinos), acá aplicado a orígenes de
  // importación.
  const concentracionUltimoAnio = calcularConcentracion(origenesDelAnio.map((d) => d.porcentaje));
  const dataHhiImportaciones = todosLosAnios
    .map((anio) => {
      const c = calcularConcentracion(agregarComexIndecPorPais(indecCompleta, anio).map((d) => d.porcentaje));
      if (c.coberturaPct < COBERTURA_MINIMA_CHART_HHI) return null;
      return { anio: String(anio), hhi: c.hhi, coberturaPct: c.coberturaPct };
    })
    .filter((f): f is { anio: string; hhi: number; coberturaPct: number } => f !== null);

  // Spread de precio FOB exportación vs. importación -- verificado con datos
  // reales antes de armarlo: en la mayoría de los años exportar rinde más
  // USD/kg que lo que se paga por importar (2020: +77%, 2022: +36%,
  // 2024: +16%), pero no siempre (2023/2025 cerca de la paridad) -- se
  // muestra la serie real, no se asume una tendencia fija.
  const precioImportPorAnio = precioFobPorAnio(indecCompleta);
  const precioExportPorAnio = precioFobPorAnio(exportacionesIndecCompleta);
  const spreadData = todosLosAnios
    .map((anio) => {
      const pi = precioImportPorAnio.get(anio);
      const pe = precioExportPorAnio.get(anio);
      if (pi == null || pe == null || pi === 0) return null;
      return { anio, etiqueta: String(anio), valor: ((pe - pi) / pi) * 100 };
    })
    .filter((f): f is { anio: number; etiqueta: string; valor: number } => f !== null);
  const precioImportUltimo = ultimoAnio !== undefined ? precioImportPorAnio.get(ultimoAnio) ?? null : null;
  const precioExportUltimo = ultimoAnio !== undefined ? precioExportPorAnio.get(ultimoAnio) ?? null : null;

  // Mapa de calor por país -- filtrado SOLO por año (independiente de
  // origenFiltro, mismo criterio que el heatmap de Exportaciones).
  const indecSoloAnio = indecCompleta.filter((f) => (!anioDesde || f.anio >= anioDesde) && (!anioHasta || f.anio <= anioHasta));
  const seriesImportacionesPais: HeatmapTableSerie[] = [
    {
      id: "(nacional)",
      label: "Total nacional",
      puntos: agregarComexIndecMensualHistorico(indecSoloAnio).map((f) => ({
        anio: f.anio,
        mes: f.mes,
        valor: f.volumen_kg != null ? f.volumen_kg * factorUnidad : null,
      })),
    },
    ...todosLosOrigenes.map((origen) => ({
      id: origen,
      label: origen,
      puntos: indecSoloAnio
        .filter((f) => f.pais_nombre === origen)
        .map((f) => ({ anio: f.anio, mes: f.mes, valor: f.peso_kg != null ? f.peso_kg * factorUnidad : null })),
    })),
  ];

  return (
    <main className="p-6 md:p-8">
      <PageHeader title="Importaciones" description="Volumen mensual importado, por país de origen (INDEC, real)." />

      <FilterBar anios={todosLosAnios} dimension={{ param: "origen", label: "Origen", opciones: todosLosOrigenes }} mostrarUnidad />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard
          label={`Importado ${ultimoAnio}${ultimoAnio !== undefined && !esAnioCompleto(ultimoAnio) ? " (parcial)" : ""}`}
          value={importadoUltimo != null ? formatMasaCompacta(importadoUltimo, unidad) : <NoData variant="kpi" />}
          valorExacto={importadoUltimo != null ? formatMasa(importadoUltimo, unidad) : undefined}
          icon={Package}
          deltaPct={deltaImportado}
          deltaLabel={`vs. ${penultimoAnio}`}
          destacado
        />
        <KpiCard
          label={`Balanza comercial ${ultimoAnio}`}
          value={balanzaUltimo != null ? formatMasa(balanzaUltimo, unidad) : <NoData variant="kpi" />}
          icon={Ship}
        />
        <KpiCard label="Países de origen" value={origenesDelAnio.length ? String(origenesDelAnio.length) : <NoData variant="kpi" />} icon={Globe2} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <ChartCard
          title="Volumen importado mensual"
          description={`Suma de ${origenFiltro ?? "todos los orígenes"} (INDEC, real), en ${unidad === "t" ? "toneladas" : "kilogramos"}`}
          className="xl:col-span-2"
        >
          <SerieChartConFiltro
            data={serieMensual.map((p) => ({ anio: p.anio, etiqueta: p.etiqueta, valor: p.produccion_kg * factorUnidad }))}
            color={CHART_BLUE}
            numberFormat={{ notation: "compact" }}
            suffix={sufijoUnidad}
            estacional
          />
        </ChartCard>

        <ChartCard
          title={`Distribución por origen (${ultimoAnio})`}
          description={`% del volumen nacional — suman ${formatPct(pctConOrigen)}`}
        >
          {origenesDelAnio.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Sin desglose por origen para {ultimoAnio} todavía.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="font-medium py-2">Origen</th>
                  <th className="font-medium py-2 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {origenesDelAnio.map((fila) => (
                  <tr key={fila.pais_iso2} className="border-b border-border last:border-0">
                    <td className="py-2 text-card-foreground">{fila.pais_nombre}</td>
                    <td className="py-2 text-right tabular-nums font-medium text-card-foreground">{formatPct(fila.porcentaje)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
        <KpiCard label={`HHI orígenes ${ultimoAnio}`} value={String(Math.round(concentracionUltimoAnio.hhi))} icon={Gauge} />
        <GaugeCard label="Top 4 orígenes concentran" valorPct={concentracionUltimoAnio.cr4} icon={Globe2} color="var(--color-accent)" />
      </div>

      <ChartCard
        title="HHI (Herfindahl-Hirschman) de orígenes por año"
        className="mt-4"
        description={
          <>
            Suma de los % de cada país al cuadrado. Es una <strong>cota inferior</strong> del HHI real (el volumen sin país publicado
            por secreto estadístico no está incluido). Umbrales de referencia: &lt;1500 no concentrado, 1500-2500 moderadamente
            concentrado, &gt;2500 altamente concentrado.
          </>
        }
      >
        {dataHhiImportaciones.length > 0 ? (
          <AnnualChartConFiltro tipo="hhi" data={dataHhiImportaciones} />
        ) : (
          <p className="text-sm text-muted-foreground py-12 text-center">Ningún año del rango seleccionado tiene cobertura suficiente para calcular HHI de forma confiable.</p>
        )}
      </ChartCard>

      <div className="mt-8 mb-4">
        <h2 className="text-lg font-semibold text-foreground">Precio FOB: exportación vs. importación</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Cuánto más (o menos) rinde por kg exportar respecto a lo que se paga por importar, cada año -- no siempre es más rentable
          exportar, se muestra la serie real.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <KpiCard label={`Precio FOB importado ${ultimoAnio}`} value={precioImportUltimo != null ? `$${formatNumero(precioImportUltimo, 2)}/kg` : <NoData variant="kpi" />} icon={Package} />
        <KpiCard label={`Precio FOB exportado ${ultimoAnio}`} value={precioExportUltimo != null ? `$${formatNumero(precioExportUltimo, 2)}/kg` : <NoData variant="kpi" />} icon={Ship} />
        <KpiCard
          label="Spread exportación vs. importación"
          value={
            precioImportUltimo != null && precioExportUltimo != null
              ? `${precioExportUltimo >= precioImportUltimo ? "+" : ""}${formatNumero(((precioExportUltimo - precioImportUltimo) / precioImportUltimo) * 100, 1)}%`
              : <NoData variant="kpi" />
          }
          icon={ArrowRightLeft}
        />
      </div>

      {spreadData.length > 0 && (
        <ChartCard title="Spread de precio FOB por año" className="mb-4" description="(precio exportación - precio importación) / precio importación, en %">
          <SerieChartConFiltro data={spreadData} color="var(--color-accent)" numberFormat={{ maximumFractionDigits: 0 }} suffix="%" />
        </ChartCard>
      )}

      <ChartCard
        title="Mapa de calor por país"
        className="mt-4 mb-4"
        description="Volumen mensual real (INDEC) por país de origen — elegí el país en el selector. Independiente del filtro Origen de arriba."
      >
        <HeatmapTable
          series={seriesImportacionesPais}
          selectorLabel="Origen"
          formato={{ tipo: "masa", unidad }}
        />
      </ChartCard>

      <ChartCard
        title="Histórico completo"
        className="mt-4"
        description={
          <>
            Total {origenFiltro ?? "nacional (todos los orígenes)"} real, INDEC Comercio Exterior — desde{" "}
            {anualHistorico[anualHistorico.length - 1]?.anio} hasta {ultimoAnio}. Ver docs/fuentes_exportaciones_indec.md.
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

      <FooterFuentes tablas={["ym.importaciones_indec", "ym.exportaciones_anual"]} />
    </main>
  );
}
