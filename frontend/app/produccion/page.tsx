import Link from "next/link";
import { Sprout, Wheat, TrendingUp, DollarSign, Gauge, Map as MapIcon, BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { ChartCard } from "@/components/chart-card";
import { FilterBar } from "@/components/filter-bar";
import { FooterFuentes } from "@/components/footer-fuentes";
import { SerieChartConFiltro } from "@/components/charts/serie-chart-con-filtro";
import { HistoricalTable } from "@/components/historical-table";
import { HeatmapTable } from "@/components/heatmap-table";
import { ProduccionMapaLoader } from "@/components/produccion-mapa-loader";
import type { ColumnaTabla } from "@/components/data-table";
import { formatMasa, formatMasaCompacta, formatNumero, formatPct, formatUsd, type UnidadMasa } from "@/lib/format";
import { getProduccionAnualReal, getSuperficie, getHojaVerde, getGeoLayerAtributos } from "@/lib/api";
import { tituloCase } from "@/lib/texto";
import {
  agregarHojaVerdeMensualNacional,
  agregarProduccionAnualNacional,
  agregarRendimientoAnual,
  type ProduccionAnualRow,
} from "@/lib/agregaciones";

// Coordenadas de las ciudades productoras — no hay geocodificación en el
// dataset del INYM, así que se ubican a mano las cabeceras conocidas.
const COORDENADAS_CIUDAD: Record<string, [number, number]> = {
  "Colonia Liebig": [-55.72, -27.53],
  "Gobernador Virasoro": [-56.03, -28.07],
  "Apóstoles": [-55.75, -27.9],
  "Montecarlo": [-54.77, -26.57],
  "Oberá": [-55.12, -27.49],
  "Santo Pipó": [-55.05, -27.2],
};

const COLUMNAS_ANUAL: ColumnaTabla<ProduccionAnualRow>[] = [
  { key: "anio", label: "Año", align: "left" },
  { key: "produccion_kg", label: "Producción (kg)", align: "right", format: "entero" },
  { key: "consumo_interno_kg", label: "Consumo interno (kg)", align: "right", format: "entero" },
  { key: "exportaciones_kg", label: "Exportado (kg)", align: "right", format: "entero" },
  { key: "precio_usd_kg_promedio", label: "Precio prom. USD/kg", align: "right", format: "decimal2" },
  { key: "valor_fob_usd", label: "Valor FOB", align: "right", format: "usd" },
];

export default async function ProduccionPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const anioDesde = Number(sp.anio_desde) || undefined;
  const anioHasta = Number(sp.anio_hasta) || undefined;
  const provinciaFiltro = typeof sp.provincia === "string" ? sp.provincia : undefined;
  const unidad: UnidadMasa = sp.unidad === "t" ? "t" : "kg";
  const sufijoUnidad = unidad === "t" ? " t" : " kg";
  const factorUnidad = unidad === "t" ? 1 / 1000 : 1;
  const vista = sp.vista === "mapa" ? "mapa" : "datos";

  const paramsSinVista = new URLSearchParams(
    Object.entries(sp).flatMap(([k, v]) => (k === "vista" || v === undefined ? [] : [[k, String(v)]]))
  );
  const hrefDatos = paramsSinVista.toString() ? `/produccion?${paramsSinVista.toString()}` : "/produccion";
  const paramsMapa = new URLSearchParams(paramsSinVista);
  paramsMapa.set("vista", "mapa");
  const hrefMapa = `/produccion?${paramsMapa.toString()}`;

  const [anualRealCompleta, superficieCompletas, hojaVerdeCompleta, superficieDeptoAtributos] = await Promise.all([
    getProduccionAnualReal(),
    getSuperficie(),
    getHojaVerde(),
    getGeoLayerAtributos<{ pcia: string; depto: string; sup_ym: number; superficie: number }>(
      "view_superficie_por_departamentos"
    ),
  ]);
  // Superficie cultivada real por departamento (19 unidades geográficas
  // reales del INYM, no las 6-7 zonas de reporte de producción) -- NO hay
  // producción en kg a este nivel de detalle en ninguna fuente encontrada,
  // solo superficie. Ver docs/auditoria_datos.md §7 caso E.
  const superficiePorDepto = superficieDeptoAtributos
    .filter((p) => p.superficie > 0 && (!provinciaFiltro || p.pcia.toUpperCase() === provinciaFiltro.toUpperCase()))
    .sort((a, b) => b.sup_ym - a.sup_ym);
  const hojaVerdeTotalPorZona = hojaVerdeCompleta.filter(
    (f) => f.zona === "TOTAL" && (!anioDesde || f.anio >= anioDesde) && (!anioHasta || f.anio <= anioHasta)
  );
  const todosLosAnios = Array.from(new Set(anualRealCompleta.map((f) => f.anio))).sort((a, b) => a - b);
  const todasLasProvincias = Array.from(
    new Set(anualRealCompleta.filter((f) => f.ciudad !== "(nacional)").map((f) => f.provincia))
  ).sort();

  const produccionPorCiudadAnio = anualRealCompleta
    .filter((f) => COORDENADAS_CIUDAD[f.ciudad] && f.produccion_kg != null)
    .map((f) => ({
      anio: f.anio,
      ciudad: f.ciudad,
      provincia: f.provincia,
      produccion_kg: f.produccion_kg!,
      lng: COORDENADAS_CIUDAD[f.ciudad][0],
      lat: COORDENADAS_CIUDAD[f.ciudad][1],
    }));
  // "Otros" es un bucket de reporte del INYM sin ubicación puntual real (no
  // es una ciudad) -- no puede tener un pin en el mapa. Se calcula cuánto
  // representa, para el último año CON desglose por ciudad (el mapa no
  // tiene nada que mostrar para años sin desglose, como 2025), para no
  // dejar la diferencia entre mapa y KPI sin explicar (ver caso E / bug de
  // mapa vs KPI, docs/auditoria_datos.md §5).
  const ultimoAnioConCiudades = Math.max(
    ...anualRealCompleta.filter((f) => f.ciudad !== "(nacional)").map((f) => f.anio)
  );
  const otrosUltimoAnio = anualRealCompleta.find(
    (f) => f.ciudad === "Otros" && f.anio === ultimoAnioConCiudades
  );

  const filas = anualRealCompleta.filter(
    (f) =>
      (!anioDesde || f.anio >= anioDesde) &&
      (!anioHasta || f.anio <= anioHasta) &&
      (!provinciaFiltro || f.provincia === provinciaFiltro || f.ciudad === "(nacional)")
  );
  const filasSuperficie = superficieCompletas.filter(
    (f) =>
      (!anioDesde || f.anio >= anioDesde) &&
      (!anioHasta || f.anio <= anioHasta) &&
      (!provinciaFiltro || f.provincia === provinciaFiltro)
  );

  const anios = Array.from(new Set(filas.map((f) => f.anio))).sort((a, b) => a - b);
  const ultimoAnio = anios[anios.length - 1];
  const penultimoAnio = anios[anios.length - 2];

  const serieMensual = agregarHojaVerdeMensualNacional(hojaVerdeTotalPorZona);

  const anualHistorico = agregarProduccionAnualNacional(filas);
  const anualUltimo = anualHistorico.find((f) => f.anio === ultimoAnio);
  const anualPenultimo = anualHistorico.find((f) => f.anio === penultimoAnio);

  const totalUltimo = anualUltimo?.produccion_kg ?? null;
  const deltaAnual =
    totalUltimo != null && anualPenultimo?.produccion_kg
      ? ((totalUltimo - anualPenultimo.produccion_kg) / anualPenultimo.produccion_kg) * 100
      : undefined;
  const exportadoUltimo = anualUltimo?.exportaciones_kg ?? null;
  const valorFobUltimo = anualUltimo?.valor_fob_usd ?? null;
  const precioPromedioUltimo = anualUltimo?.precio_usd_kg_promedio ?? null;

  const rendimientoAnual = agregarRendimientoAnual(filas, filasSuperficie);
  const rendimientoUltimo = rendimientoAnual.find((f) => f.anio === ultimoAnio);
  const rendimientoPenultimo = rendimientoAnual.find((f) => f.anio === penultimoAnio);
  const deltaRendimiento =
    rendimientoUltimo && rendimientoPenultimo
      ? ((rendimientoUltimo.rendimiento_kg_ha - rendimientoPenultimo.rendimiento_kg_ha) / rendimientoPenultimo.rendimiento_kg_ha) * 100
      : undefined;

  return (
    <main className="p-6 md:p-8">
      <PageHeader
        title="Producción"
        description="Serie mensual y distribución geográfica de la producción de yerba mate elaborada."
      />

      <div className="flex items-center gap-2 mb-6">
        <Link
          href={hrefDatos}
          aria-current={vista === "datos" ? "page" : undefined}
          className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-full border transition-colors ${
            vista === "datos"
              ? "bg-primary border-primary text-on-primary shadow-sm"
              : "border-border bg-card text-foreground/70 hover:text-foreground hover:border-primary/40"
          }`}
        >
          <BarChart3 size={14} aria-hidden="true" />
          Datos
        </Link>
        <Link
          href={hrefMapa}
          aria-current={vista === "mapa" ? "page" : undefined}
          className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-full border transition-colors ${
            vista === "mapa"
              ? "bg-primary border-primary text-on-primary shadow-sm"
              : "border-border bg-card text-foreground/70 hover:text-foreground hover:border-primary/40"
          }`}
        >
          <MapIcon size={14} aria-hidden="true" />
          Mapa
        </Link>
      </div>

      {vista === "mapa" ? (
        <>
          <ProduccionMapaLoader produccionPorCiudadAnio={produccionPorCiudadAnio} />
          {otrosUltimoAnio?.produccion_kg != null && (
            <p className="text-xs text-muted-foreground mt-2">
              El mapa no incluye &ldquo;Otros&rdquo; ({formatMasa(otrosUltimoAnio.produccion_kg, unidad)} en{" "}
              {otrosUltimoAnio.anio}) — es un bucket de reporte del INYM sin una ubicación puntual real, no una
              ciudad geolocalizable.
            </p>
          )}
        </>
      ) : (
        <>
        <FilterBar
          anios={todosLosAnios}
          dimension={{ param: "provincia", label: "Provincia", opciones: todasLasProvincias }}
          mostrarUnidad
        />

        {filas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin datos para los filtros seleccionados.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <KpiCard
                label={`Producción ${ultimoAnio}`}
                value={totalUltimo != null ? formatMasaCompacta(totalUltimo, unidad) : "Sin dato"}
                valorExacto={totalUltimo != null ? formatMasa(totalUltimo, unidad) : undefined}
                icon={Sprout}
                deltaPct={deltaAnual}
                deltaLabel={`vs. ${penultimoAnio}`}
                destacado
              />
              <KpiCard label={`Exportado ${ultimoAnio}`} value={exportadoUltimo != null ? formatMasa(exportadoUltimo, unidad) : "Sin dato"} icon={Wheat} />
              <KpiCard label="Precio promedio USD/kg" value={precioPromedioUltimo != null ? formatNumero(precioPromedioUltimo, 2) : "Sin dato"} icon={TrendingUp} />
              <KpiCard label={`Valor FOB exportado ${ultimoAnio}`} value={valorFobUltimo != null ? formatUsd(valorFobUltimo) : "Sin dato"} icon={DollarSign} />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <ChartCard
                title="Cosecha nacional mensual"
                description="Ingreso de hoja verde a secadero (INYM, zona TOTAL) — dato mensual real, no una curva estimada"
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
                title="Superficie cultivada por departamento"
                description="Hectáreas reales (INYM GeoServer), 19 departamentos — no hay producción en kg publicada a este nivel de detalle, solo superficie (ver Mapa GIS para el coroplético)"
              >
                {superficiePorDepto.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">Sin datos de superficie para los filtros seleccionados.</p>
                ) : (
                  <div className="max-h-[360px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-card">
                        <tr className="text-left text-xs text-muted-foreground border-b border-border">
                          <th className="font-medium py-2">Departamento</th>
                          <th className="font-medium py-2 text-right">Ha cultivadas</th>
                          <th className="font-medium py-2 text-right">% del depto.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {superficiePorDepto.map((fila) => (
                          <tr key={`${fila.depto}|${fila.pcia}`} className="border-b border-border last:border-0">
                            <td className="py-2">
                              <div className="text-card-foreground">{tituloCase(fila.depto)}</div>
                              <div className="text-xs text-muted-foreground">{tituloCase(fila.pcia)}</div>
                            </td>
                            <td className="py-2 text-right tabular-nums font-medium text-card-foreground">
                              {formatNumero(fila.sup_ym, 0)} ha
                            </td>
                            <td className="py-2 text-right tabular-nums text-muted-foreground">
                              {formatPct((fila.sup_ym / fila.superficie) * 100)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </ChartCard>
            </div>

            {rendimientoAnual.length > 0 && (
              <>
                <div className="mt-8 mb-4">
                  <h2 className="text-lg font-semibold text-foreground">Rendimiento por hectárea</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Producción / superficie cultivada, por año — la superficie se publica con cadencia anual (ym.superficie_productores).
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <KpiCard
                    label={`Rendimiento ${ultimoAnio}`}
                    value={rendimientoUltimo ? `${formatNumero(rendimientoUltimo.rendimiento_kg_ha, 0)} kg/ha` : "Sin dato"}
                    icon={Gauge}
                    deltaPct={deltaRendimiento}
                    deltaLabel={`vs. ${penultimoAnio}`}
                  />
                  <KpiCard
                    label={`Superficie cultivada ${ultimoAnio}`}
                    value={rendimientoUltimo ? `${formatNumero(rendimientoUltimo.superficie_ha, 0)} ha` : "Sin dato"}
                    icon={Sprout}
                  />
                </div>

                <ChartCard title="Rendimiento nacional por año" description="kg de hoja verde por hectárea cultivada">
                  <SerieChartConFiltro
                    data={rendimientoAnual.map((f) => ({ anio: f.anio, etiqueta: String(f.anio), valor: f.rendimiento_kg_ha }))}
                    color="#a16207"
                    numberFormat={{ maximumFractionDigits: 0 }}
                    suffix=" kg/ha"
                  />
                </ChartCard>
              </>
            )}

            <ChartCard
              title="Histórico anual"
              className="mt-4"
              description={
                <>
                  Total {provinciaFiltro ?? "nacional"} real, desde {anualHistorico[anualHistorico.length - 1]?.anio}{" "}
                  hasta {ultimoAnio} (ver docs/auditoria_datos.md — el desglose mensual de esta tabla se anuló por ser
                  sintético; para cosecha mes a mes real, ver el gráfico y el mapa de calor de arriba/abajo).
                </>
              }
            >
              <HistoricalTable columnasAnual={COLUMNAS_ANUAL} filasAnual={anualHistorico} />
            </ChartCard>

            <ChartCard
              title="Mapa de calor — ingreso de hoja verde a secadero"
              className="mt-4"
              description={
                <>
                  Cosecha real mes a mes (INYM, zona TOTAL), no el desglose mensual de &ldquo;Producción (kg)&rdquo; de arriba —
                  ese total anual es real, pero su reparto entre los 12 meses es una curva estimada, no una medición (se repite
                  idéntica todos los años). Acá cada año se colorea de mínimo a máximo, resaltando el pico real de cosecha
                  (abril-septiembre) y la caída de floración (octubre-diciembre). Algunos meses sin publicación quedan &ldquo;s/d&rdquo;.
                </>
              }
            >
              <HeatmapTable
                filas={hojaVerdeTotalPorZona.map((f) => ({ anio: f.anio, mes: f.mes, valor: f.hoja_verde_kg * factorUnidad }))}
                formatearValor={(v) => formatNumero(v, unidad === "t" ? 1 : 0)}
                formatearTotal={(v) => formatMasa(v, unidad)}
                escala="fila"
              />
            </ChartCard>
          </>
        )}
        </>
      )}

      <FooterFuentes
        tablas={["ym.dataset_principal_anual", "ym.superficie_productores", "ym.inym_hoja_verde_zona", "inym_gis.raw_features"]}
      />
    </main>
  );
}
