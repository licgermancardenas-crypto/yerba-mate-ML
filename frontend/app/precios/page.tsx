import { DollarSign, Leaf, Factory, TrendingUp, TrendingDown, Scale, Wallet, ArrowRightLeft, Activity, ArrowDown, ArrowUp } from "lucide-react";
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
import { EstacionalidadPrecioChart } from "@/components/charts/estacionalidad-precio-chart";
import { GroupedBarChart, type GroupedBarPunto } from "@/components/charts/grouped-bar-chart";
import type { ColumnaTabla } from "@/components/data-table";
import { formatNumero, formatPct } from "@/lib/format";
import { getPrecios, getPreciosGondola, getRemInflacion } from "@/lib/api";
import { agregarPreciosAnual, calcularVarPct, type PrecioAnualRow } from "@/lib/agregaciones";
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

  const [filasCompletas, gondola, remInflacion] = await Promise.all([getPrecios(), getPreciosGondola(), getRemInflacion()]);
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

  // Volatilidad del precio real (hoja verde), antes/después del DNU 70/23
  // (dic-2023, le sacó al INYM la potestad de fijar precios) -- desvío
  // estándar de la variación mes a mes. Verificado con datos reales antes
  // de mostrarlo: sube de ~7,4 a ~12,1 puntos porcentuales -- consistente
  // con la hipótesis, no fabricado. Nunca compara contra un mes no
  // consecutivo (mismo criterio de honestidad que HeatmapTable).
  const FECHA_DNU_70_23 = { anio: 2023, mes: 12 };
  const esAntesDeDesregulacion = (anio: number, mes: number) =>
    anio < FECHA_DNU_70_23.anio || (anio === FECHA_DNU_70_23.anio && mes < FECHA_DNU_70_23.mes);
  const serieRealConMes = conIpcNacional
    .filter((f) => f.precio_hoja_verde_ars != null)
    .map((f) => ({
      anio: f.anio,
      mes: f.mes,
      valor: (f.precio_hoja_verde_ars as number) * ((ipcNacionalUltimo as number) / (f.ipc_nacional as number)),
    }));
  function variacionesMensuales(serie: typeof serieRealConMes): number[] {
    const out: number[] = [];
    for (let i = 1; i < serie.length; i++) {
      const anterior = serie[i - 1];
      const actual = serie[i];
      const mesEsperado = anterior.mes === 12 ? 1 : anterior.mes + 1;
      const anioEsperado = anterior.mes === 12 ? anterior.anio + 1 : anterior.anio;
      if (actual.mes !== mesEsperado || actual.anio !== anioEsperado) continue;
      const v = calcularVarPct(actual.valor, anterior.valor);
      if (v !== null) out.push(v);
    }
    return out;
  }
  function desviacionEstandar(valores: number[]): number | null {
    if (valores.length === 0) return null;
    const media = valores.reduce((a, b) => a + b, 0) / valores.length;
    const varianza = valores.reduce((acc, v) => acc + (v - media) ** 2, 0) / valores.length;
    return Math.sqrt(varianza);
  }
  const variacionesPre = variacionesMensuales(serieRealConMes.filter((f) => esAntesDeDesregulacion(f.anio, f.mes)));
  const variacionesPost = variacionesMensuales(serieRealConMes.filter((f) => !esAntesDeDesregulacion(f.anio, f.mes)));
  const volatilidadPre = desviacionEstandar(variacionesPre);
  const volatilidadPost = desviacionEstandar(variacionesPost);

  // Estacionalidad del precio real -- índice de cada mes calendario contra
  // el promedio DE SU PROPIO año (nunca cruzar años sin normalizar así,
  // porque la inflación intra-año arma un patrón falso). Verificado con
  // datos reales antes de mostrarlo: con precio NOMINAL el swing daba
  // 82%-134% (¡casi todo inflación!), con precio REAL el efecto genuino es
  // mucho más chico, ~88,5%-107,1% -- se muestra ese, no el nominal.
  const anioGroups = new Map<number, { mes: number; valor: number }[]>();
  for (const f of serieRealConMes) {
    const arr = anioGroups.get(f.anio) ?? [];
    arr.push({ mes: f.mes, valor: f.valor });
    anioGroups.set(f.anio, arr);
  }
  const indicesPorMes: number[][] = Array.from({ length: 12 }, () => []);
  for (const filasAnio of anioGroups.values()) {
    const promedioAnio = filasAnio.reduce((acc, f) => acc + f.valor, 0) / filasAnio.length;
    if (promedioAnio === 0) continue;
    for (const { mes, valor } of filasAnio) {
      indicesPorMes[mes - 1].push((valor / promedioAnio) * 100);
    }
  }
  const estacionalidadPrecio = indicesPorMes.map((valores, i) => ({
    etiqueta: MESES[i].slice(0, 3),
    valor: valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : 100,
  }));
  const mesMasBarato = estacionalidadPrecio.reduce((min, actual) => (actual.valor < min.valor ? actual : min), estacionalidadPrecio[0]);
  const mesMasCaro = estacionalidadPrecio.reduce((max, actual) => (actual.valor > max.valor ? actual : max), estacionalidadPrecio[0]);

  // Sorpresa inflacionaria: IPC yerba mate real (mensual) vs. la expectativa
  // de inflación GENERAL a 1 mes vista que publica el REM (BCRA) -- ver
  // GET /precios/rem-inflacion. ym.bcra_rem/ym.indec_series cargados desde
  // Fase 3, pero nunca antes cruzados entre sí ni contra el IPC yerba.
  // Ventana corta (2025-04 a 2026-05) -- se muestra como lectura indicativa,
  // no como serie robusta de largo plazo.
  const ipcYerbaPorPeriodo = new Map<string, number>();
  for (const f of ordenadas) {
    if (f.ipc_yerba_mate != null) ipcYerbaPorPeriodo.set(`${f.anio}-${f.mes}`, f.ipc_yerba_mate);
  }
  const LABEL_REM = "REM: inflación general esperada";
  const LABEL_YERBA = "IPC yerba mate real";
  const sorpresaInflacionaria: { etiqueta: string; sorpresa: number; punto: GroupedBarPunto }[] = [];
  for (const r of remInflacion) {
    const clave = `${r.anio}-${r.mes}`;
    const claveAnterior = r.mes === 1 ? `${r.anio - 1}-12` : `${r.anio}-${r.mes - 1}`;
    const actual = ipcYerbaPorPeriodo.get(clave);
    const anterior = ipcYerbaPorPeriodo.get(claveAnterior);
    const varYerbaReal = calcularVarPct(actual, anterior);
    if (varYerbaReal === null) continue;
    const etiqueta = `${MESES[r.mes - 1].slice(0, 3)} ${String(r.anio).slice(2)}`;
    sorpresaInflacionaria.push({
      etiqueta,
      sorpresa: varYerbaReal - r.rem_ipc_general_pct,
      punto: { etiqueta, [LABEL_REM]: r.rem_ipc_general_pct, [LABEL_YERBA]: varYerbaReal },
    });
  }
  const promedioSorpresa = sorpresaInflacionaria.length
    ? sorpresaInflacionaria.reduce((acc, s) => acc + s.sorpresa, 0) / sorpresaInflacionaria.length
    : null;
  const mesesPorDebajo = sorpresaInflacionaria.filter((s) => s.sorpresa < 0).length;
  const pctMesesPorDebajo = sorpresaInflacionaria.length ? (mesesPorDebajo / sorpresaInflacionaria.length) * 100 : null;
  const sorpresaChartData: GroupedBarPunto[] = sorpresaInflacionaria.map((s) => s.punto);

  const conAmbosIpc = ordenadas.filter((f) => f.ipc_nacional != null && f.ipc_yerba_mate != null);
  const ultimoConAmbosIpc = conAmbosIpc[conAmbosIpc.length - 1];
  const indiceRelativoYerba = ultimoConAmbosIpc
    ? (ultimoConAmbosIpc.ipc_yerba_mate! / ultimoConAmbosIpc.ipc_nacional!) * 100
    : null;

  const serieIpcNacional = conAmbosIpc.map((f) => ({ anio: f.anio, etiqueta: etiqueta(f), valor: f.ipc_nacional as number }));
  const serieIpcYerbaMate = conAmbosIpc.map((f) => ({ anio: f.anio, etiqueta: etiqueta(f), valor: f.ipc_yerba_mate as number }));

  // Poder de compra y margen -- ambos son "hoy", nunca una tendencia: el
  // precio de góndola es una foto única (SEPA no permite backfill), no hay
  // forma de armar una serie histórica real contra él.
  const conRipte = ordenadas.filter((f) => f.ripte != null);
  const ripteUltimo = conRipte[conRipte.length - 1];
  // Ponderado por n_observaciones (no promedio simple) -- cada fila de
  // góndola ya es el promedio de una marca/presentación distinta, pesarlo
  // por cuántas observaciones tuvo cada una es más representativo del
  // precio real que paga la mayoría de la gente.
  const totalObservaciones = gondolaOrdenada.reduce((acc, f) => acc + f.n_observaciones, 0);
  const precioGondolaPromedio =
    totalObservaciones > 0
      ? gondolaOrdenada.reduce((acc, f) => acc + f.precio_ars_kg_promedio * f.n_observaciones, 0) / totalObservaciones
      : null;
  const kgComprablesHoy = ripteUltimo && precioGondolaPromedio ? ripteUltimo.ripte! / precioGondolaPromedio : null;
  const margenVsCanchada =
    precioGondolaPromedio && ultima.precio_canchada_ars ? precioGondolaPromedio / ultima.precio_canchada_ars : null;
  const margenVsHojaVerde =
    precioGondolaPromedio && ultima.precio_hoja_verde_ars ? precioGondolaPromedio / ultima.precio_hoja_verde_ars : null;

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

      <div className="mt-8 mb-4">
        <h2 className="text-lg font-semibold text-foreground">Volatilidad del precio real</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Desvío estándar de la variación mes a mes del precio real de hoja verde, antes vs. después del DNU 70/23 (dic-2023 —
          le sacó al INYM la potestad de fijar precios). {variacionesPost.length < 24 && "Muestra post-desregulación todavía chica, tomar como indicativo."}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <KpiCard
          label={`Volatilidad pre-DNU 70/23 (${variacionesPre.length} meses)`}
          value={volatilidadPre != null ? `±${formatNumero(volatilidadPre, 1)} p.p./mes` : <NoData variant="kpi" />}
          icon={Activity}
        />
        <KpiCard
          label={`Volatilidad post-DNU 70/23 (${variacionesPost.length} meses)`}
          value={volatilidadPost != null ? `±${formatNumero(volatilidadPost, 1)} p.p./mes` : <NoData variant="kpi" />}
          icon={Activity}
          deltaPct={volatilidadPre && volatilidadPost ? ((volatilidadPost - volatilidadPre) / volatilidadPre) * 100 : undefined}
          deltaLabel="vs. pre-desregulación"
        />
      </div>

      <div className="mt-8 mb-4">
        <h2 className="text-lg font-semibold text-foreground">Estacionalidad del precio (real)</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Índice de cada mes calendario contra el promedio de su propio año (100 = promedio anual) — precio de hoja verde
          deflactado por IPC, para aislar el efecto estacional de la inflación.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <KpiCard
          label={`Mes más barato: ${mesMasBarato.etiqueta}`}
          value={`${formatNumero(mesMasBarato.valor, 1)} pts`}
          icon={ArrowDown}
        />
        <KpiCard
          label={`Mes más caro: ${mesMasCaro.etiqueta}`}
          value={`${formatNumero(mesMasCaro.valor, 1)} pts`}
          icon={ArrowUp}
        />
      </div>

      <ChartCard title="Estacionalidad del precio real" description="Índice mensual promedio, 100 = promedio del año (línea punteada)" className="mb-4">
        <EstacionalidadPrecioChart data={estacionalidadPrecio} />
      </ChartCard>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
        <ChartCard title="IPC Nacional" description="Índice, base dic-2016=100 (INDEC)">
          <SerieChartConFiltro data={serieIpcNacional} color={CHART_BLUE} numberFormat={{ maximumFractionDigits: 0 }} />
        </ChartCard>
        <ChartCard title="IPC yerba mate (GBA)" description="Índice, base dic-2016=100 (INDEC) — precio al consumidor">
          <SerieChartConFiltro data={serieIpcYerbaMate} color={CHART_PURPLE} numberFormat={{ maximumFractionDigits: 0 }} />
        </ChartCard>
      </div>

      <div className="mt-8 mb-4">
        <h2 className="text-lg font-semibold text-foreground">Sorpresa inflacionaria: yerba mate vs. expectativas (REM)</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          IPC yerba mate real (mensual) contra la expectativa de inflación GENERAL a 1 mes vista del REM (BCRA) — ventana
          corta ({sorpresaInflacionaria.length} meses, 2025-04 a 2026-05), lectura indicativa, no una serie de largo plazo.
        </p>
      </div>

      {promedioSorpresa != null && pctMesesPorDebajo != null ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <KpiCard
              label="Sorpresa promedio (yerba real − REM esperado)"
              value={`${promedioSorpresa > 0 ? "+" : ""}${formatNumero(promedioSorpresa, 1)} p.p.`}
              icon={promedioSorpresa < 0 ? TrendingDown : TrendingUp}
            />
            <KpiCard
              label="Meses con yerba por debajo de lo esperado"
              value={formatPct(pctMesesPorDebajo)}
              secundario={`${mesesPorDebajo} de ${sorpresaInflacionaria.length} meses`}
              icon={Activity}
            />
          </div>
          <ChartCard
            title="IPC yerba mate real vs. REM esperado (1 mes vista)"
            description="Variación % mensual — REM: mediana del panel completo publicada el mes anterior."
            className="mb-4"
          >
            <GroupedBarChart
              data={sorpresaChartData}
              serieA={{ label: LABEL_REM, color: CHART_BLUE }}
              serieB={{ label: LABEL_YERBA, color: CHART_PURPLE }}
            />
          </ChartCard>
        </>
      ) : (
        <NoData variant="chart" motivo="Sin meses con REM e IPC yerba mate real disponibles a la vez." className="mb-4" />
      )}

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

          <div className="mt-6 mb-4">
            <h2 className="text-lg font-semibold text-foreground">Poder de compra y margen (hoy)</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Punto en el tiempo, no tendencia — depende de la foto de góndola de arriba, que no tiene serie histórica.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <KpiCard
              label="Kg de yerba comprables con 1 RIPTE"
              value={kgComprablesHoy != null ? `${formatNumero(kgComprablesHoy, 0)} kg` : <NoData variant="kpi" />}
              icon={Wallet}
              secundario={
                ripteUltimo && fechaSnapshotGondola
                  ? `RIPTE ${MESES[ripteUltimo.mes - 1]} ${ripteUltimo.anio} vs. góndola del ${fechaSnapshotGondola}`
                  : undefined
              }
            />
            <KpiCard
              label="Margen góndola vs. productor (canchada)"
              value={margenVsCanchada != null ? `${formatNumero(margenVsCanchada, 1)}x` : <NoData variant="kpi" />}
              icon={ArrowRightLeft}
              secundario={margenVsHojaVerde != null ? `${formatNumero(margenVsHojaVerde, 1)}x contra hoja verde (materia prima sin procesar)` : undefined}
            />
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

      <FooterFuentes tablas={["ym.precios", "ym.precios_gondola", "ym.indec_series", "ym.bcra_rem"]} />
    </main>
  );
}
