import { DollarSign, Leaf, Factory, TrendingUp, Scale } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { NoData } from "@/components/no-data";
import { ChartCard } from "@/components/chart-card";
import { FilterBar } from "@/components/filter-bar";
import { FooterFuentes } from "@/components/footer-fuentes";
import { SerieChartConFiltro } from "@/components/charts/serie-chart-con-filtro";
import { CHART_BLUE, CHART_PURPLE } from "@/components/charts/chart-theme";
import { HistoricalTable } from "@/components/historical-table";
import { HeatmapTable, type HeatmapTableSerie } from "@/components/heatmap-table";
import type { ColumnaTabla } from "@/components/data-table";
import { formatNumero, formatPct } from "@/lib/format";
import { getPrecios, getPreciosGondola } from "@/lib/api";
import { agregarPreciosAnual, type PrecioAnualRow } from "@/lib/agregaciones";
import type { PrecioRow } from "@/lib/types";

const COLUMNAS_ANUAL: ColumnaTabla<PrecioAnualRow>[] = [
  { key: "anio", label: "Año", align: "left" },
  { key: "precio_hoja_verde_ars_promedio", label: "Hoja verde prom. (ARS/kg)", align: "right", format: "ars" },
  { key: "precio_canchada_ars_promedio", label: "Canchada prom. (ARS/kg)", align: "right", format: "ars" },
];

const COLUMNAS_MENSUAL: ColumnaTabla<PrecioRow>[] = [
  { key: "anio", label: "Año", align: "left" },
  { key: "mes_nombre", label: "Mes", align: "left" },
  { key: "precio_hoja_verde_ars", label: "Hoja verde (ARS/kg)", align: "right", format: "ars" },
  { key: "precio_canchada_ars", label: "Canchada (ARS/kg)", align: "right", format: "ars" },
];

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function formatArsKg(valor: number): string {
  return `$${formatNumero(valor, 2)}/kg`;
}

export default async function PreciosPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const anioDesde = Number(sp.anio_desde) || undefined;
  const anioHasta = Number(sp.anio_hasta) || undefined;

  const [filasCompletas, gondola] = await Promise.all([getPrecios(), getPreciosGondola()]);
  const todosLosAnios = Array.from(new Set(filasCompletas.map((f) => f.anio))).sort((a, b) => a - b);
  const gondolaOrdenada = [...gondola].sort(
    (a, b) => (a.empresa_ym ?? a.marca_gondola).localeCompare(b.empresa_ym ?? b.marca_gondola) || a.presentacion_kg - b.presentacion_kg
  );
  const fechaSnapshotGondola = gondola[0]?.fecha_snapshot;

  const filas = filasCompletas.filter(
    (f) => (!anioDesde || f.anio >= anioDesde) && (!anioHasta || f.anio <= anioHasta)
  );
  const ordenadas = [...filas].sort((a, b) => a.anio - b.anio || a.mes - b.mes);

  if (ordenadas.length === 0) {
    return (
      <main className="p-6 md:p-8">
        <PageHeader title="Precios" description="Serie histórica de precio de hoja verde y canchada (ARS/kg)." />
        <FilterBar anios={todosLosAnios} />
        <NoData variant="chart" motivo="Sin datos para los filtros seleccionados." />
      </main>
    );
  }

  const ultima = ordenadas[ordenadas.length - 1];
  const haceUnAnio = ordenadas.find((f) => f.anio === ultima.anio - 1 && f.mes === ultima.mes);

  const deltaHojaVerde =
    ultima.precio_hoja_verde_ars != null && haceUnAnio?.precio_hoja_verde_ars
      ? ((ultima.precio_hoja_verde_ars - haceUnAnio.precio_hoja_verde_ars) / haceUnAnio.precio_hoja_verde_ars) * 100
      : undefined;
  const deltaCanchada =
    ultima.precio_canchada_ars != null && haceUnAnio?.precio_canchada_ars
      ? ((ultima.precio_canchada_ars - haceUnAnio.precio_canchada_ars) / haceUnAnio.precio_canchada_ars) * 100
      : undefined;

  const relacion =
    ultima.precio_canchada_ars && ultima.precio_hoja_verde_ars
      ? ultima.precio_canchada_ars / ultima.precio_hoja_verde_ars
      : null;

  const etiqueta = (f: (typeof ordenadas)[number]) => `${MESES[f.mes - 1].slice(0, 3)} ${String(f.anio).slice(2)}`;

  const serieHojaVerde = ordenadas
    .filter((f) => f.precio_hoja_verde_ars != null)
    .map((f) => ({ anio: f.anio, etiqueta: etiqueta(f), valor: f.precio_hoja_verde_ars as number }));
  const serieCanchada = ordenadas
    .filter((f) => f.precio_canchada_ars != null)
    .map((f) => ({ anio: f.anio, etiqueta: etiqueta(f), valor: f.precio_canchada_ars as number }));

  const anualHistorico = agregarPreciosAnual(filas);
  const mensualHistorico = [...ordenadas].reverse();

  // Precio real (deflactado por IPC Nacional, en pesos del último mes con dato) e
  // índice relativo yerba mate vs. inflación general — ambas series de INDEC
  // comparten la misma base (dic-2016=100), ver ym.indec_series / docs/indec_series.md.
  const conIpcNacional = ordenadas.filter((f) => f.ipc_nacional != null);
  const ipcNacionalUltimo = conIpcNacional[conIpcNacional.length - 1]?.ipc_nacional ?? null;

  const serieHojaVerdeReal = conIpcNacional
    .filter((f) => f.precio_hoja_verde_ars != null)
    .map((f) => ({
      anio: f.anio,
      etiqueta: etiqueta(f),
      valor: (f.precio_hoja_verde_ars as number) * ((ipcNacionalUltimo as number) / (f.ipc_nacional as number)),
    }));
  const serieCanchadaReal = conIpcNacional
    .filter((f) => f.precio_canchada_ars != null)
    .map((f) => ({
      anio: f.anio,
      etiqueta: etiqueta(f),
      valor: (f.precio_canchada_ars as number) * ((ipcNacionalUltimo as number) / (f.ipc_nacional as number)),
    }));

  const haceUnAnioConIpc =
    haceUnAnio?.ipc_nacional != null && haceUnAnio.precio_hoja_verde_ars != null
      ? (haceUnAnio.precio_hoja_verde_ars as number) * ((ipcNacionalUltimo as number) / haceUnAnio.ipc_nacional)
      : null;
  const realHojaVerdeUltima = serieHojaVerdeReal[serieHojaVerdeReal.length - 1]?.valor ?? null;
  const deltaRealHojaVerde =
    realHojaVerdeUltima != null && haceUnAnioConIpc
      ? ((realHojaVerdeUltima - haceUnAnioConIpc) / haceUnAnioConIpc) * 100
      : undefined;

  const conAmbosIpc = ordenadas.filter((f) => f.ipc_nacional != null && f.ipc_yerba_mate != null);
  const ultimoConAmbosIpc = conAmbosIpc[conAmbosIpc.length - 1];
  const indiceRelativoYerba = ultimoConAmbosIpc
    ? (ultimoConAmbosIpc.ipc_yerba_mate! / ultimoConAmbosIpc.ipc_nacional!) * 100
    : null;

  const serieIpcNacional = conAmbosIpc.map((f) => ({ anio: f.anio, etiqueta: etiqueta(f), valor: f.ipc_nacional as number }));
  const serieIpcYerbaMate = conAmbosIpc.map((f) => ({ anio: f.anio, etiqueta: etiqueta(f), valor: f.ipc_yerba_mate as number }));

  const seriesPrecios: HeatmapTableSerie[] = [
    { id: "hoja_verde", label: "Hoja verde", puntos: filas.map((f) => ({ anio: f.anio, mes: f.mes, valor: f.precio_hoja_verde_ars })) },
    { id: "canchada", label: "Canchada", puntos: filas.map((f) => ({ anio: f.anio, mes: f.mes, valor: f.precio_canchada_ars })) },
  ];

  return (
    <main className="p-6 md:p-8">
      <PageHeader
        title="Precios"
        description="Serie histórica de precio de hoja verde y canchada (ARS/kg) — resoluciones INYM/SAGyP (Ley 25.564). El mecanismo de precio de referencia fue discontinuado por el INYM el 31/03/2026 (Decreto 812, desregulación); ver docs/fuentes_precios_materia_prima.md."
      />

      <FilterBar anios={todosLosAnios} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard
          label={`Hoja verde (nominal) ${MESES[ultima.mes - 1]} ${ultima.anio}`}
          value={ultima.precio_hoja_verde_ars != null ? formatArsKg(ultima.precio_hoja_verde_ars) : <NoData variant="kpi" />}
          icon={Leaf}
          deltaPct={deltaHojaVerde}
          deltaLabel="vs. año anterior"
          destacado
        />
        <KpiCard
          label={`Canchada (nominal) ${MESES[ultima.mes - 1]} ${ultima.anio}`}
          value={ultima.precio_canchada_ars != null ? formatArsKg(ultima.precio_canchada_ars) : <NoData variant="kpi" />}
          icon={Factory}
          deltaPct={deltaCanchada}
          deltaLabel="vs. año anterior"
        />
        <KpiCard
          label="Relación canchada / hoja verde"
          value={relacion != null ? `${formatNumero(relacion, 2)}x` : <NoData variant="kpi" />}
          icon={DollarSign}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard title="Precio hoja verde (nominal)" description="ARS/kg, serie completa">
          <SerieChartConFiltro data={serieHojaVerde} color="var(--color-primary)" prefix="$" suffix="/kg" numberFormat={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }} />
        </ChartCard>

        <ChartCard title="Precio canchada (nominal)" description="ARS/kg, serie completa">
          <SerieChartConFiltro data={serieCanchada} color="var(--color-accent)" prefix="$" suffix="/kg" numberFormat={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }} />
        </ChartCard>
      </div>

      <div className="mt-8 mb-4">
        <h2 className="text-lg font-semibold text-foreground">Precio real y relación con la inflación</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Deflactado con el IPC Nacional (INDEC) y comparado contra el IPC específico de yerba mate (GBA) — ambas series con base dic-2016=100.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <KpiCard
          label="Hoja verde (real, deflactado IPC)"
          value={realHojaVerdeUltima != null ? formatArsKg(realHojaVerdeUltima) : <NoData variant="kpi" />}
          icon={TrendingUp}
          deltaPct={deltaRealHojaVerde}
          deltaLabel="real, vs. año anterior"
        />
        <KpiCard
          label="Yerba mate vs. inflación general (acum. desde dic-2016)"
          value={indiceRelativoYerba != null ? formatPct(indiceRelativoYerba - 100) : <NoData variant="kpi" />}
          secundario={
            indiceRelativoYerba != null ? `Índice: ${formatNumero(indiceRelativoYerba, 0)} pts (precio relativo vs. IPC, base dic-16=100)` : undefined
          }
          icon={Scale}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard title="Precio hoja verde (real, deflactado IPC)" description="ARS/kg deflactado, en pesos del último mes con dato de IPC">
          <SerieChartConFiltro data={serieHojaVerdeReal} color="var(--color-primary)" prefix="$" suffix="/kg" numberFormat={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }} />
        </ChartCard>
        <ChartCard title="Precio canchada (real, deflactado IPC)" description="ARS/kg deflactado, en pesos del último mes con dato de IPC">
          <SerieChartConFiltro data={serieCanchadaReal} color="var(--color-accent)" prefix="$" suffix="/kg" numberFormat={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
        <ChartCard title="IPC Nacional" description="Índice, base dic-2016=100 (INDEC)">
          <SerieChartConFiltro data={serieIpcNacional} color={CHART_BLUE} numberFormat={{ maximumFractionDigits: 0 }} />
        </ChartCard>
        <ChartCard title="IPC yerba mate (GBA)" description="Índice, base dic-2016=100 (INDEC) — precio al consumidor">
          <SerieChartConFiltro data={serieIpcYerbaMate} color={CHART_PURPLE} numberFormat={{ maximumFractionDigits: 0 }} />
        </ChartCard>
      </div>

      {gondolaOrdenada.length > 0 && (
        <>
          <div className="mt-8 mb-4">
            <h2 className="text-lg font-semibold text-foreground">Precio de góndola (SEPA)</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Foto del {fechaSnapshotGondola} — no es serie histórica (el portal SEPA no permite backfill), precio de venta al público relevado en supermercados adheridos.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-shadow duration-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="font-medium py-2 pr-3">Marca</th>
                  <th className="font-medium py-2 pr-3">Empresa</th>
                  <th className="font-medium py-2 pr-3 text-right">Presentación</th>
                  <th className="font-medium py-2 pr-3 text-right">Precio prom. $/kg</th>
                  <th className="font-medium py-2 pr-3 text-right">Rango</th>
                  <th className="font-medium py-2 text-right">Sucursales relevadas</th>
                </tr>
              </thead>
              <tbody>
                {gondolaOrdenada.map((f) => (
                  <tr key={`${f.marca_gondola}-${f.presentacion_kg}`} className="border-b border-border last:border-0">
                    <td className="py-2 pr-3 text-card-foreground font-medium">{f.marca_gondola}</td>
                    <td className="py-2 pr-3 text-muted-foreground">
                      {f.empresa_ym ?? <span className="italic">sin confirmar</span>}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatNumero(f.presentacion_kg, 2)} kg</td>
                    <td className="py-2 pr-3 text-right tabular-nums font-medium text-card-foreground">
                      {formatArsKg(f.precio_ars_kg_promedio)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">
                      {formatArsKg(f.precio_ars_kg_min)} – {formatArsKg(f.precio_ars_kg_max)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-muted-foreground">
                      {f.n_observaciones} ({f.n_comercios} {f.n_comercios === 1 ? "cadena" : "cadenas"})
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <ChartCard
        title="Mapa de calor — precio hoja verde / canchada"
        className="mt-4 mb-4"
        description={
          <>
            ARS/kg mensual real. El mecanismo de precio de referencia fue discontinuado por el INYM el 31/03/2026 (Decreto 812) — los
            meses posteriores quedan &ldquo;s/d&rdquo;, no es un hueco de carga.
          </>
        }
      >
        <HeatmapTable series={seriesPrecios} selectorLabel="Serie" formato={{ tipo: "ars" }} />
      </ChartCard>

      <ChartCard
        title="Histórico completo"
        className="mt-4"
        description={
          <>Desde {anualHistorico[anualHistorico.length - 1]?.anio} hasta {ultima.anio}. El promedio anual ignora meses sin precio publicado por el INYM.</>
        }
      >
        <HistoricalTable
          columnasAnual={COLUMNAS_ANUAL}
          filasAnual={anualHistorico}
          columnasMensual={COLUMNAS_MENSUAL}
          filasMensual={mensualHistorico}
        />
      </ChartCard>

      <FooterFuentes tablas={["ym.precios", "ym.precios_gondola"]} />
    </main>
  );
}
