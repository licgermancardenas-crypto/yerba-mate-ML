import { Ship, Globe2, DollarSign, TrendingUp, PieChart, Package2, Boxes, HelpCircle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { GaugeCard } from "@/components/gauge-card";
import { ChartCard } from "@/components/chart-card";
import { FilterBar } from "@/components/filter-bar";
import { HistoricalTable } from "@/components/historical-table";
import { ExportacionesFlowMapLoader } from "@/components/exportaciones-flow-map-loader";
import type { ColumnaTabla } from "@/components/data-table";
import { formatMasa, formatNumero, formatPct, formatUsd, type UnidadMasa } from "@/lib/format";
import { getExportacionesAnualReal } from "@/lib/api";
import { agregarExportacionesAnualNacional, type ExportacionAnualRow } from "@/lib/agregaciones";

const COLUMNAS_ANUAL: ColumnaTabla<ExportacionAnualRow>[] = [
  { key: "anio", label: "Año", align: "left" },
  { key: "volumen_kg", label: "Volumen (kg)", align: "right", format: "entero" },
  { key: "valor_fob_usd", label: "Valor FOB", align: "right", format: "usd" },
  { key: "precio_fob_usd_kg_promedio", label: "Precio prom. FOB USD/kg", align: "right", format: "decimal2" },
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

  const anualRealCompleta = await getExportacionesAnualReal();
  const todosLosAnios = Array.from(new Set(anualRealCompleta.map((f) => f.anio))).sort((a, b) => a - b);
  const todosLosDestinos = Array.from(
    new Set(anualRealCompleta.filter((f) => f.destino !== "(nacional)").map((f) => f.destino))
  ).sort();

  const filas = anualRealCompleta.filter(
    (f) =>
      (!anioDesde || f.anio >= anioDesde) &&
      (!anioHasta || f.anio <= anioHasta) &&
      (!destinoFiltro || f.destino === destinoFiltro || f.destino === "(nacional)")
  );

  const anios = Array.from(new Set(filas.map((f) => f.anio))).sort((a, b) => a - b);
  const ultimoAnio = anios[anios.length - 1];
  const penultimoAnio = anios[anios.length - 2];

  const anualHistorico = agregarExportacionesAnualNacional(filas);
  const anualUltimo = anualHistorico.find((f) => f.anio === ultimoAnio);
  const anualPenultimo = anualHistorico.find((f) => f.anio === penultimoAnio);

  const volumenUltimo = anualUltimo?.volumen_kg ?? null;
  const deltaVolumen =
    volumenUltimo != null && anualPenultimo?.volumen_kg
      ? ((volumenUltimo - anualPenultimo.volumen_kg) / anualPenultimo.volumen_kg) * 100
      : undefined;
  const valorFobUltimo = anualUltimo?.valor_fob_usd ?? null;
  const precioPromedioUltimo = anualUltimo?.precio_fob_usd_kg_promedio ?? null;

  const destinos = filas
    .filter((f) => f.anio === ultimoAnio && f.destino !== "(nacional)" && f.volumen_kg != null)
    .map((f) => ({
      destino: f.destino,
      volumen_kg: f.volumen_kg!,
      valor_fob_usd: f.valor_fob_usd ?? 0,
      porcentaje: volumenUltimo ? (f.volumen_kg! / volumenUltimo) * 100 : 0,
    }))
    .sort((a, b) => b.volumen_kg - a.volumen_kg);

  return (
    <main className="p-6 md:p-8">
      <PageHeader
        title="Exportaciones"
        description="Volumen y valor FOB por país destino, evolución histórica."
      />

      <FilterBar anios={todosLosAnios} dimension={{ param: "destino", label: "Destino", opciones: todosLosDestinos }} mostrarUnidad />

      {filas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin datos para los filtros seleccionados.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KpiCard
              label={`Volumen exportado ${ultimoAnio}`}
              value={volumenUltimo != null ? formatMasa(volumenUltimo, unidad) : "Sin dato"}
              icon={Ship}
              deltaPct={deltaVolumen}
              deltaLabel={`vs. ${penultimoAnio}`}
              destacado
            />
            <KpiCard label={`Valor FOB ${ultimoAnio}`} value={valorFobUltimo != null ? formatUsd(valorFobUltimo) : "Sin dato"} icon={DollarSign} />
            <KpiCard label="Precio FOB promedio USD/kg" value={precioPromedioUltimo != null ? formatNumero(precioPromedioUltimo, 2) : "Sin dato"} icon={TrendingUp} />
            <KpiCard label="Países destino" value={destinos.length ? String(destinos.length) : "Sin dato"} icon={Globe2} />
          </div>

          <ChartCard
            title="Sin desglose mensual real todavía"
            description="El desglose mensual de exportaciones anterior era 100% sintético (ver docs/auditoria_datos.md) y se anuló. El total anual de arriba sí es real."
            className="mb-4"
          >
            <p className="text-sm text-muted-foreground">
              Fuente real identificada y validada (96% de cobertura vs. el total oficial INYM 2025): INDEC Comercio
              Exterior, posiciones NCM 09030010/09030090, mensual por país, 2002-presente
              (<code>comexbe.indec.gob.ar/public-api/search</code>). Falta construir el ETL para cargarla — pendiente
              en TODO.md.
            </p>
          </ChartCard>

          <ChartCard title={`Distribución por destino (${ultimoAnio})`} description="% del volumen total exportado" className="mb-4">
            {destinos.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                Sin desglose por destino para {ultimoAnio} todavía — solo hay total nacional (ver KPI arriba).
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="font-medium py-2">Destino</th>
                    <th className="font-medium py-2 text-right">%</th>
                  </tr>
                </thead>
                <tbody>
                  {destinos.map((fila) => (
                    <tr key={fila.destino} className="border-b border-border last:border-0">
                      <td className="py-2 text-card-foreground">{fila.destino}</td>
                      <td className="py-2 text-right tabular-nums font-medium text-card-foreground">
                        {formatPct(fila.porcentaje)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </ChartCard>

          {destinos.length > 0 && (
            <ChartCard
              title="Mapa de flujos de exportación"
              description={`Argentina → ${destinoFiltro ?? "principales destinos"} (${ultimoAnio}) — grosor y opacidad del arco = % del volumen total. Click en un destino para filtrar toda la página.`}
            >
              <div className="h-[420px] -m-1">
                <ExportacionesFlowMapLoader destinos={destinos} destinoFiltro={destinoFiltro ?? null} />
              </div>
            </ChartCard>
          )}

          <div className="mt-8 mb-4 flex items-center gap-2">
            <PieChart size={16} className="text-primary" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-foreground">Composición: a granel vs. fraccionado</h2>
          </div>
          <p className="text-sm text-muted-foreground -mt-2 mb-4">
            Dato puntual (no serie histórica, no está en <code>ym.exportaciones</code>) — Bolsa de Comercio de Rosario, Informativo
            Semanal N.° 2222 (28/11/2025), sobre datos de enero-septiembre 2025.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <GaugeCard label="A granel" valorPct={57} icon={Package2} color="var(--color-primary)" descripcion="Bolsas de 50 kg sin fraccionar" />
            <GaugeCard label="Fraccionado" valorPct={29} icon={Boxes} color="var(--color-accent)" descripcion="Consumo minorista (1/4 kg a 2 kg)" />
            <GaugeCard label="Resto" valorPct={14} displayValue="~14%" icon={HelpCircle} color="var(--color-muted-foreground)" descripcion="Sin desglosar en la fuente" />
          </div>

          <ChartCard
            title="Histórico anual"
            className="mt-8"
            description={
              <>
                Total {destinoFiltro ?? "nacional (todos los destinos)"} real, desde{" "}
                {anualHistorico[anualHistorico.length - 1]?.anio} hasta {ultimoAnio}
              </>
            }
          >
            <HistoricalTable columnasAnual={COLUMNAS_ANUAL} filasAnual={anualHistorico} />
          </ChartCard>
        </>
      )}
    </main>
  );
}
