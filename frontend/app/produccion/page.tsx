import Link from "next/link";
import { Sprout, Wheat, TrendingUp, DollarSign, Gauge, Map as MapIcon, BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { ChartCard } from "@/components/chart-card";
import { FilterBar } from "@/components/filter-bar";
import { SerieChartConFiltro } from "@/components/charts/serie-chart-con-filtro";
import { HistoricalTable } from "@/components/historical-table";
import { HeatmapTable } from "@/components/heatmap-table";
import { ProduccionMapaLoader } from "@/components/produccion-mapa-loader";
import type { ColumnaTabla } from "@/components/data-table";
import { formatMasa, formatNumero, formatPct, formatUsd, type UnidadMasa } from "@/lib/format";
import { getProduccion, getSuperficie, getHojaVerde } from "@/lib/api";
import {
  agregarProduccionMensual,
  agregarProduccionPorCiudad,
  agregarProduccionAnual,
  agregarProduccionMensualNacional,
  agregarRendimientoAnual,
  type ProduccionAnualRow,
  type ProduccionMensualNacionalRow,
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

const COLUMNAS_MENSUAL: ColumnaTabla<ProduccionMensualNacionalRow>[] = [
  { key: "anio", label: "Año", align: "left" },
  { key: "mes_nombre", label: "Mes", align: "left" },
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

  const [filasCompletas, superficieCompletas, hojaVerdeCompleta] = await Promise.all([
    getProduccion(),
    getSuperficie(),
    getHojaVerde(),
  ]);
  const hojaVerdeTotalPorZona = hojaVerdeCompleta.filter(
    (f) => f.zona === "TOTAL" && (!anioDesde || f.anio >= anioDesde) && (!anioHasta || f.anio <= anioHasta)
  );
  const todosLosAnios = Array.from(new Set(filasCompletas.map((f) => f.anio))).sort((a, b) => a - b);
  const todasLasProvincias = Array.from(new Set(filasCompletas.map((f) => f.provincia))).sort();

  const produccionPorCiudadAnioMap = new Map<string, { anio: number; ciudad: string; provincia: string; produccion_kg: number }>();
  for (const f of filasCompletas) {
    const coords = COORDENADAS_CIUDAD[f.ciudad];
    if (!coords) continue;
    const key = `${f.anio}|${f.ciudad}`;
    const acc = produccionPorCiudadAnioMap.get(key);
    if (acc) acc.produccion_kg += f.produccion_kg;
    else produccionPorCiudadAnioMap.set(key, { anio: f.anio, ciudad: f.ciudad, provincia: f.provincia, produccion_kg: f.produccion_kg });
  }
  const produccionPorCiudadAnio = Array.from(produccionPorCiudadAnioMap.values()).map((f) => ({
    ...f,
    lng: COORDENADAS_CIUDAD[f.ciudad][0],
    lat: COORDENADAS_CIUDAD[f.ciudad][1],
  }));

  const filas = filasCompletas.filter(
    (f) =>
      (!anioDesde || f.anio >= anioDesde) &&
      (!anioHasta || f.anio <= anioHasta) &&
      (!provinciaFiltro || f.provincia === provinciaFiltro)
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

  const serieMensual = agregarProduccionMensual(filas);
  const porCiudadUltimo = agregarProduccionPorCiudad(filas, ultimoAnio);
  const porCiudadPenultimo = agregarProduccionPorCiudad(filas, penultimoAnio);

  const totalUltimo = porCiudadUltimo.reduce((acc, r) => acc + r.produccion_kg, 0);
  const totalPenultimo = porCiudadPenultimo.reduce((acc, r) => acc + r.produccion_kg, 0);
  const deltaAnual = totalPenultimo ? ((totalUltimo - totalPenultimo) / totalPenultimo) * 100 : undefined;

  const filasUltimoAnio = filas.filter((f) => f.anio === ultimoAnio);
  const exportadoUltimo = filasUltimoAnio.reduce((acc, f) => acc + f.exportaciones_kg, 0);
  const valorFobUltimo = filasUltimoAnio.reduce((acc, f) => acc + f.valor_fob_usd, 0);
  const precioPromedioUltimo =
    filasUltimoAnio.reduce((acc, f) => acc + f.precio_usd_kg, 0) / filasUltimoAnio.length;

  const anualHistorico = agregarProduccionAnual(filas);
  const mensualHistorico = agregarProduccionMensualNacional(filas);

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
        <ProduccionMapaLoader produccionPorCiudadAnio={produccionPorCiudadAnio} />
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
              <KpiCard label={`Producción ${ultimoAnio}`} value={formatMasa(totalUltimo, unidad)} icon={Sprout} deltaPct={deltaAnual} deltaLabel={`vs. ${penultimoAnio}`} destacado />
              <KpiCard label={`Exportado ${ultimoAnio}`} value={formatMasa(exportadoUltimo, unidad)} icon={Wheat} />
              <KpiCard label="Precio promedio USD/kg" value={formatNumero(precioPromedioUltimo, 2)} icon={TrendingUp} />
              <KpiCard label={`Valor FOB exportado ${ultimoAnio}`} value={formatUsd(valorFobUltimo)} icon={DollarSign} />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <ChartCard
                title="Producción nacional mensual"
                description={`Suma de las ciudades productoras, en ${unidad === "t" ? "toneladas" : "kilogramos"}`}
                className="xl:col-span-2"
              >
                <SerieChartConFiltro
                  data={serieMensual.map((p) => ({ anio: p.anio, etiqueta: p.etiqueta, valor: p.produccion_kg * factorUnidad }))}
                  numberFormat={{ notation: "compact" }}
                  suffix={sufijoUnidad}
                />
              </ChartCard>

              <ChartCard title={`Distribución por ciudad (${ultimoAnio})`} description="% del total nacional">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border">
                      <th className="font-medium py-2">Ciudad</th>
                      <th className="font-medium py-2 text-right">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porCiudadUltimo.map((fila) => (
                      <tr key={fila.ciudad} className="border-b border-border last:border-0">
                        <td className="py-2">
                          <div className="text-card-foreground">{fila.ciudad}</div>
                          <div className="text-xs text-muted-foreground">{fila.provincia}</div>
                        </td>
                        <td className="py-2 text-right tabular-nums font-medium text-card-foreground">
                          {formatPct(fila.porcentaje)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
              title="Histórico completo"
              className="mt-4"
              description={
                <>
                  Total {provinciaFiltro ?? "nacional"} (suma de {provinciaFiltro ? "las ciudades de la provincia" : "todas las ciudades productoras"}), desde{" "}
                  {anualHistorico[anualHistorico.length - 1]?.anio} hasta {ultimoAnio}
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
    </main>
  );
}
