import { Ship, Globe2, DollarSign, TrendingUp, PieChart, Package2, Boxes, HelpCircle, Gauge } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { NoData } from "@/components/no-data";
import { GaugeCard } from "@/components/gauge-card";
import { ChartCard } from "@/components/chart-card";
import { FilterBar } from "@/components/filter-bar";
import { FooterFuentes } from "@/components/footer-fuentes";
import { SerieChartConFiltro } from "@/components/charts/serie-chart-con-filtro";
import { AnnualChartConFiltro } from "@/components/charts/annual-chart-con-filtro";
import { HistoricalTable } from "@/components/historical-table";
import { HeatmapTable, type HeatmapTableSerie } from "@/components/heatmap-table";
import { ExportacionesFlowMapLoader } from "@/components/exportaciones-flow-map-loader";
import type { ColumnaTabla } from "@/components/data-table";
import { formatMasa, formatMasaCompacta, formatNumero, formatPct, formatUsd, type UnidadMasa } from "@/lib/format";
import { getExportacionesAnualReal, getExportacionesIndec } from "@/lib/api";
import {
  agregarExportacionesAnualNacional,
  agregarComexIndecAnualNacional,
  agregarComexIndecMensualNacional,
  agregarComexIndecMensualHistorico,
  agregarComexIndecPorPais,
  type ExportacionAnualRow,
  type ComexIndecMensualNacionalRow,
} from "@/lib/agregaciones";
import { calcularConcentracion } from "@/lib/metricas-competencia";

const COBERTURA_MINIMA_CHART_HHI = 50;

const COLUMNAS_ANUAL: ColumnaTabla<ExportacionAnualRow>[] = [
  { key: "anio", label: "Año", align: "left" },
  { key: "volumen_kg", label: "Volumen (kg)", align: "right", format: "entero" },
  { key: "valor_fob_usd", label: "Valor FOB", align: "right", format: "usd" },
  { key: "precio_fob_usd_kg_promedio", label: "Precio prom. FOB USD/kg", align: "right", format: "decimal2" },
];

const COLUMNAS_MENSUAL: ColumnaTabla<ComexIndecMensualNacionalRow>[] = [
  { key: "anio", label: "Año", align: "left" },
  { key: "mes_nombre", label: "Mes", align: "left" },
  { key: "volumen_kg", label: "Volumen (kg)", align: "right", format: "entero" },
];

export default async function ExportacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const anioDesde = Number(sp.anio_desde) || undefined;
  const anioHasta = Number(sp.anio_hasta) || undefined;
  const destinoFiltro = typeof sp.destino === "string" ? sp.destino : undefined;
  const unidad: UnidadMasa = sp.unidad === "t" ? "t" : "kg";
  const sufijoUnidad = unidad === "t" ? " t" : " kg";
  const factorUnidad = unidad === "t" ? 1 / 1000 : 1;

  const [anualRealCompleta, indecCompleta] = await Promise.all([getExportacionesAnualReal(), getExportacionesIndec()]);
  const todosLosAnios = Array.from(new Set(anualRealCompleta.map((f) => f.anio))).sort((a, b) => a - b);
  const todosLosDestinos = Array.from(new Set(indecCompleta.map((f) => f.pais_nombre))).filter((n) => n !== "Confidencial").sort();

  const filas = anualRealCompleta.filter(
    (f) => (!anioDesde || f.anio >= anioDesde) && (!anioHasta || f.anio <= anioHasta)
  );
  const indecFiltrado = indecCompleta.filter(
    (f) =>
      (!anioDesde || f.anio >= anioDesde) &&
      (!anioHasta || f.anio <= anioHasta) &&
      (!destinoFiltro || f.pais_nombre === destinoFiltro)
  );

  const anios = Array.from(new Set(filas.map((f) => f.anio))).sort((a, b) => a - b);
  const ultimoAnio = anios[anios.length - 1];
  const penultimoAnio = anios[anios.length - 2];

  // ym.exportaciones_anual (comunicados INYM) no siempre publica FOB para el
  // año más reciente -- si falta, se completa con el total real de
  // ym.exportaciones_indec (misma fuente que ya alimenta el desglose por
  // destino de esta página), año por año.
  const anualHistoricoBase = agregarExportacionesAnualNacional(filas);
  const indecAnualHistorico = agregarComexIndecAnualNacional(indecCompleta);
  const indecPorAnio = new Map(indecAnualHistorico.map((f) => [f.anio, f]));
  const aniosConFallbackFob = new Set<number>();
  const anualHistorico: ExportacionAnualRow[] = anualHistoricoBase.map((f) => {
    if (f.valor_fob_usd != null) return f;
    const indec = indecPorAnio.get(f.anio);
    if (indec?.valor_fob_usd == null || !indec.volumen_kg) return f;
    aniosConFallbackFob.add(f.anio);
    return { ...f, valor_fob_usd: indec.valor_fob_usd, precio_fob_usd_kg_promedio: indec.valor_fob_usd / indec.volumen_kg };
  });
  const anualUltimo = anualHistorico.find((f) => f.anio === ultimoAnio);
  const anualPenultimo = anualHistorico.find((f) => f.anio === penultimoAnio);

  const volumenUltimo = anualUltimo?.volumen_kg ?? null;
  const deltaVolumen =
    volumenUltimo != null && anualPenultimo?.volumen_kg
      ? ((volumenUltimo - anualPenultimo.volumen_kg) / anualPenultimo.volumen_kg) * 100
      : undefined;
  const valorFobUltimo = anualUltimo?.valor_fob_usd ?? null;
  const precioPromedioUltimo = anualUltimo?.precio_fob_usd_kg_promedio ?? null;
  const usaFallbackFob = ultimoAnio != null && aniosConFallbackFob.has(ultimoAnio);
  const coberturaFobPct =
    usaFallbackFob && volumenUltimo ? ((indecPorAnio.get(ultimoAnio)?.volumen_kg ?? 0) / volumenUltimo) * 100 : null;

  const serieMensual = agregarComexIndecMensualNacional(indecFiltrado);
  const mensualHistorico = agregarComexIndecMensualHistorico(indecFiltrado);
  const destinosDelAnio = agregarComexIndecPorPais(indecCompleta, ultimoAnio ?? 0);
  const pctConDestino = destinosDelAnio.reduce((acc, d) => acc + d.porcentaje, 0);

  const destinosMapa = destinosDelAnio.map((d) => ({
    destino: d.pais_iso2,
    volumen_kg: d.volumen_kg,
    valor_fob_usd: d.valor_fob_usd,
    porcentaje: d.porcentaje,
  }));

  // Concentración de destinos (HHI) -- mismo cálculo que ya usa /competencia
  // para empresas (calcularConcentracion), acá aplicado a países. porcentaje
  // de agregarComexIndecPorPais ya está contra el total nacional (incluye
  // 'ZZ' confidencial), así que coberturaPct < 100 es la parte sin país
  // publicado -- mismo criterio de "cota inferior" que en Competencia.
  const concentracionUltimoAnio = calcularConcentracion(destinosDelAnio.map((d) => d.porcentaje));
  const dataHhiExportaciones = todosLosAnios
    .map((anio) => {
      const c = calcularConcentracion(agregarComexIndecPorPais(indecCompleta, anio).map((d) => d.porcentaje));
      if (c.coberturaPct < COBERTURA_MINIMA_CHART_HHI) return null;
      return { anio: String(anio), hhi: c.hhi, coberturaPct: c.coberturaPct };
    })
    .filter((f): f is { anio: string; hhi: number; coberturaPct: number } => f !== null);

  // Precio FOB por destino -- USD/kg de cada país, verificado contra datos
  // reales antes de mostrarlo: mercados nicho (Australia, Suiza, Alemania)
  // pagan 2x+ lo que pagan los mercados de mayor volumen (Siria, Brasil) --
  // no es ruido, es un patrón real y consistente.
  const precioFobPorDestino = destinosDelAnio
    .filter((d) => d.volumen_kg > 0)
    .map((d) => ({ pais_iso2: d.pais_iso2, pais_nombre: d.pais_nombre, precio_fob_usd_kg: d.valor_fob_usd / d.volumen_kg, volumen_kg: d.volumen_kg }))
    .sort((a, b) => b.precio_fob_usd_kg - a.precio_fob_usd_kg);

  // Mapa de calor por país -- filtrado SOLO por año (deliberadamente sin
  // destinoFiltro: el selector de este widget es independiente del FilterBar
  // de la página, para poder comparar cualquier país sin perder el filtro
  // general). "Confidencial" ya excluido en todosLosDestinos.
  const indecSoloAnio = indecCompleta.filter((f) => (!anioDesde || f.anio >= anioDesde) && (!anioHasta || f.anio <= anioHasta));
  const seriesExportacionesPais: HeatmapTableSerie[] = [
    {
      id: "(nacional)",
      label: "Total nacional",
      puntos: agregarComexIndecMensualHistorico(indecSoloAnio).map((f) => ({
        anio: f.anio,
        mes: f.mes,
        valor: f.volumen_kg != null ? f.volumen_kg * factorUnidad : null,
      })),
    },
    ...todosLosDestinos.map((destino) => ({
      id: destino,
      label: destino,
      puntos: indecSoloAnio
        .filter((f) => f.pais_nombre === destino)
        .map((f) => ({ anio: f.anio, mes: f.mes, valor: f.peso_kg != null ? f.peso_kg * factorUnidad : null })),
    })),
  ];

  return (
    <main className="p-6 md:p-8">
      <PageHeader
        title="Exportaciones"
        description="Volumen y valor FOB por país destino, evolución histórica."
      />

      <FilterBar anios={todosLosAnios} dimension={{ param: "destino", label: "Destino", opciones: todosLosDestinos }} mostrarUnidad />

      {filas.length === 0 ? (
        <NoData variant="chart" motivo="Sin datos para los filtros seleccionados." />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KpiCard
              label={`Volumen exportado ${ultimoAnio}`}
              value={volumenUltimo != null ? formatMasaCompacta(volumenUltimo, unidad) : <NoData variant="kpi" />}
              valorExacto={volumenUltimo != null ? formatMasa(volumenUltimo, unidad) : undefined}
              icon={Ship}
              deltaPct={deltaVolumen}
              deltaLabel={`vs. ${penultimoAnio}`}
              destacado
            />
            <KpiCard
              label={`Valor FOB ${ultimoAnio}`}
              value={valorFobUltimo != null ? formatUsd(valorFobUltimo) : <NoData variant="kpi" motivo="Sin dato FOB para este año, ni en el comunicado INYM ni en INDEC Comercio Exterior." />}
              icon={DollarSign}
              secundario={usaFallbackFob ? `INDEC, real — ${formatNumero(coberturaFobPct ?? 0, 0)}% del volumen (resto sin país/valor por secreto estadístico)` : undefined}
            />
            <KpiCard
              label="Precio FOB promedio USD/kg"
              value={precioPromedioUltimo != null ? formatNumero(precioPromedioUltimo, 2) : <NoData variant="kpi" motivo="Depende de Valor FOB, sin dato para este año." />}
              icon={TrendingUp}
            />
            <KpiCard label="Países destino" value={destinosDelAnio.length ? String(destinosDelAnio.length) : <NoData variant="kpi" />} icon={Globe2} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <ChartCard
              title="Volumen exportado mensual"
              description={`Suma de ${destinoFiltro ?? "todos los destinos"} (INDEC, real), en ${unidad === "t" ? "toneladas" : "kilogramos"} — meses con secreto estadístico completo quedan sin punto`}
              className="xl:col-span-2"
            >
              <SerieChartConFiltro
                data={serieMensual.map((p) => ({ anio: p.anio, etiqueta: p.etiqueta, valor: p.produccion_kg * factorUnidad }))}
                numberFormat={{ notation: "compact" }}
                suffix={sufijoUnidad}
                estacional
              />
            </ChartCard>

            <ChartCard
              title={`Distribución por destino (${ultimoAnio})`}
              description={`% del volumen nacional — suman ${formatNumero(pctConDestino, 1)}%, el resto (${formatNumero(100 - pctConDestino, 1)}%) es secreto estadístico sin país publicado`}
            >
              {destinosDelAnio.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">Sin desglose por destino para {ultimoAnio} todavía.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border">
                      <th className="font-medium py-2">Destino</th>
                      <th className="font-medium py-2 text-right">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {destinosDelAnio.map((fila) => (
                      <tr key={fila.pais_iso2} className="border-b border-border last:border-0">
                        <td className="py-2 text-card-foreground">{fila.pais_nombre}</td>
                        <td className="py-2 text-right tabular-nums font-medium text-card-foreground">
                          {formatPct(fila.porcentaje)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <KpiCard label={`HHI destinos ${ultimoAnio}`} value={String(Math.round(concentracionUltimoAnio.hhi))} icon={Gauge} />
            <GaugeCard label="Top 4 destinos concentran" valorPct={concentracionUltimoAnio.cr4} icon={Globe2} color="var(--color-accent)" />
          </div>

          <ChartCard
            title="HHI (Herfindahl-Hirschman) de destinos por año"
            className="mt-4"
            description={
              <>
                Suma de los % de cada país al cuadrado. Es una <strong>cota inferior</strong> del HHI real (el volumen sin país publicado
                por secreto estadístico no está incluido). Umbrales de referencia: &lt;1500 no concentrado, 1500-2500 moderadamente
                concentrado, &gt;2500 altamente concentrado.
              </>
            }
          >
            {dataHhiExportaciones.length > 0 ? (
              <AnnualChartConFiltro tipo="hhi" data={dataHhiExportaciones} />
            ) : (
              <p className="text-sm text-muted-foreground py-12 text-center">Ningún año del rango seleccionado tiene cobertura suficiente para calcular HHI de forma confiable.</p>
            )}
          </ChartCard>

          <ChartCard
            title={`Precio FOB por destino (${ultimoAnio})`}
            className="mt-4"
            description="USD/kg -- quién paga más por el mismo producto, no solo quién compra más volumen. Países con volumen muy chico pueden tener un precio poco representativo (un solo embarque)."
          >
            {precioFobPorDestino.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Sin desglose por destino para {ultimoAnio} todavía.</p>
            ) : (
              <div className="max-h-[420px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card">
                    <tr className="text-left text-xs text-muted-foreground border-b border-border">
                      <th className="font-medium py-2">Destino</th>
                      <th className="font-medium py-2 text-right">USD/kg</th>
                      <th className="font-medium py-2 text-right">Volumen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {precioFobPorDestino.map((fila) => (
                      <tr key={fila.pais_iso2} className="border-b border-border last:border-0">
                        <td className="py-2 text-card-foreground">{fila.pais_nombre}</td>
                        <td className="py-2 text-right tabular-nums font-medium text-card-foreground">${formatNumero(fila.precio_fob_usd_kg, 2)}</td>
                        <td className="py-2 text-right tabular-nums text-muted-foreground">{formatMasaCompacta(fila.volumen_kg, unidad)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ChartCard>

          {destinosMapa.length > 0 && (
            <ChartCard
              title="Mapa de flujos de exportación"
              description={`Argentina → ${destinoFiltro ?? "principales destinos"} (${ultimoAnio}, INDEC real) — grosor y opacidad del arco = % del volumen total. Click en un destino para filtrar toda la página. Solo se dibujan los ~30 destinos con volumen relevante geolocalizados.`}
              className="mt-4"
            >
              <div className="h-[420px] -m-1">
                <ExportacionesFlowMapLoader destinos={destinosMapa} destinoFiltro={null} />
              </div>
            </ChartCard>
          )}

          <div className="mt-8 mb-4 flex items-center gap-2">
            <PieChart size={16} className="text-primary" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-foreground">Composición: a granel vs. fraccionado</h2>
          </div>
          <p className="text-sm text-muted-foreground -mt-2 mb-4">
            Dato puntual (no serie histórica, no está en <code>ym.exportaciones_indec</code>) — Bolsa de Comercio de
            Rosario, Informativo Semanal N.° 2222 (28/11/2025), sobre datos de enero-septiembre 2025.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <GaugeCard label="A granel" valorPct={57} icon={Package2} color="var(--color-primary)" descripcion="Bolsas de 50 kg sin fraccionar" />
            <GaugeCard label="Fraccionado" valorPct={29} icon={Boxes} color="var(--color-accent)" descripcion="Consumo minorista (1/4 kg a 2 kg)" />
            <GaugeCard label="Resto" valorPct={14} displayValue="~14%" icon={HelpCircle} color="var(--color-muted-foreground)" descripcion="Sin desglosar en la fuente" />
          </div>

          <ChartCard
            title="Mapa de calor por país"
            className="mt-8 mb-4"
            description="Volumen mensual real (INDEC) por país destino — elegí el país en el selector. Independiente del filtro Destino de arriba."
          >
            <HeatmapTable
              series={seriesExportacionesPais}
              selectorLabel="Destino"
              formato={{ tipo: "masa", unidad }}
            />
          </ChartCard>

          <ChartCard
            title="Histórico completo"
            className="mt-8"
            description={
              <>
                Anual: total nacional real, desde {anualHistorico[anualHistorico.length - 1]?.anio} hasta {ultimoAnio}.
                Mensual: INDEC por destino, real (no la curva sintética anulada) — ver docs/fuentes_exportaciones_indec.md.
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
        </>
      )}

      <FooterFuentes tablas={["ym.exportaciones_anual", "ym.exportaciones_indec"]} />
    </main>
  );
}
