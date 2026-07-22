import { Leaf, Factory, Globe2, Percent, CalendarRange, Link2, Activity } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { NoData } from "@/components/no-data";
import { GaugeCard } from "@/components/gauge-card";
import { ChartCard } from "@/components/chart-card";
import { FilterBar } from "@/components/filter-bar";
import { FooterFuentes } from "@/components/footer-fuentes";
import { SerieChartConFiltro } from "@/components/charts/serie-chart-con-filtro";
import { AnnualChartConFiltro } from "@/components/charts/annual-chart-con-filtro";
import { SerieMensualChart } from "@/components/charts/serie-mensual-chart";
import { HistoricalTable } from "@/components/historical-table";
import { HeatmapTable, type HeatmapTableSerie } from "@/components/heatmap-table";
import { DataTable, type ColumnaTabla } from "@/components/data-table";
import { ElasticidadConsumoChart, type ElasticidadConsumoPunto } from "@/components/charts/elasticidad-consumo-chart";
import { esAnioCompleto, formatMasa, formatMasaCompacta, formatNumero, type UnidadMasa } from "@/lib/format";
import { getHojaVerde, getSalidaMolino } from "@/lib/api";
import {
  agregarHojaVerdeAnual,
  agregarSalidaMolinoAnual,
  agregarSalidaMolinoMensual,
  calcularVarPct,
  type HojaVerdeAnualRow,
  type SalidaMolinoAnualRow,
  type SalidaMolinoMensualRow,
} from "@/lib/agregaciones";
import { ZONA_RAW_A_LIMPIA, ZONAS, etiquetaZona } from "@/lib/zonas";
import type { HojaVerdeRow } from "@/lib/types";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const COLUMNAS_HOJA_VERDE_ANUAL: ColumnaTabla<HojaVerdeAnualRow>[] = [
  { key: "anio", label: "Año", align: "left" },
  { key: "hoja_verde_kg", label: "Hoja verde ingresada (kg)", align: "right", format: "entero" },
];

const COLUMNAS_HOJA_VERDE_MENSUAL: ColumnaTabla<HojaVerdeRow>[] = [
  { key: "anio", label: "Año", align: "left" },
  { key: "mes", label: "Mes", align: "left" },
  { key: "hoja_verde_kg", label: "Hoja verde ingresada (kg)", align: "right", format: "entero" },
];

const COLUMNAS_MOLINO_ANUAL: ColumnaTabla<SalidaMolinoAnualRow>[] = [
  { key: "anio", label: "Año", align: "left" },
  { key: "interno_kg", label: "Mercado interno (kg)", align: "right", format: "entero" },
  { key: "externo_kg", label: "Mercado externo (kg)", align: "right", format: "entero" },
  { key: "total_kg", label: "Total (kg)", align: "right", format: "entero" },
];

const COLUMNAS_MOLINO_MENSUAL: ColumnaTabla<SalidaMolinoMensualRow>[] = [
  { key: "anio", label: "Año", align: "left" },
  { key: "mes_nombre", label: "Mes", align: "left" },
  { key: "interno_kg", label: "Mercado interno (kg)", align: "right", format: "entero" },
  { key: "externo_kg", label: "Mercado externo (kg)", align: "right", format: "entero" },
  { key: "total_kg", label: "Total (kg)", align: "right", format: "entero" },
];

type ZonaPivotRow = { zona: string } & Record<string, string | number>;

export default async function CadenaProductivaPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const anioDesde = Number(sp.anio_desde) || undefined;
  const anioHasta = Number(sp.anio_hasta) || undefined;
  const unidad: UnidadMasa = sp.unidad === "t" ? "t" : "kg";
  const sufijoUnidad = unidad === "t" ? " t" : " kg";
  const factorUnidad = unidad === "t" ? 1 / 1000 : 1;

  const [filasHojaVerdeCompletas, filasMolinoCompletas] = await Promise.all([getHojaVerde(), getSalidaMolino()]);
  const todosLosAnios = Array.from(new Set(filasHojaVerdeCompletas.map((f) => f.anio))).sort((a, b) => a - b);

  const filasHojaVerde = filasHojaVerdeCompletas.filter(
    (f) => (!anioDesde || f.anio >= anioDesde) && (!anioHasta || f.anio <= anioHasta)
  );
  const filasMolino = filasMolinoCompletas.filter(
    (f) => (!anioDesde || f.anio >= anioDesde) && (!anioHasta || f.anio <= anioHasta)
  );

  if (filasHojaVerde.length === 0) {
    return (
      <main className="p-6 md:p-8">
        <PageHeader
          title="Cadena Productiva"
          description="Ingreso de hoja verde a secadero por zona y salida de molino (interno/externo) — fuente: reportes mensuales del INYM."
        />
        <FilterBar anios={todosLosAnios} mostrarUnidad />
        <NoData variant="chart" motivo="Sin datos para los filtros seleccionados." />
      </main>
    );
  }

  const hojaVerdeAnual = agregarHojaVerdeAnual(filasHojaVerde);
  const hojaVerdeMensualNacional = [...filasHojaVerde]
    .filter((f) => f.zona === "TOTAL")
    .sort((a, b) => b.anio - a.anio || b.mes - a.mes);

  const ultimoAnio = hojaVerdeAnual[0]?.anio;
  const penultimoAnio = hojaVerdeAnual[1]?.anio;
  const hojaVerdeUltimo = hojaVerdeAnual.find((f) => f.anio === ultimoAnio)?.hoja_verde_kg ?? 0;
  const hojaVerdePenultimo = hojaVerdeAnual.find((f) => f.anio === penultimoAnio)?.hoja_verde_kg ?? 0;
  // Año en curso (ultimoAnio) casi nunca tiene los 12 meses publicados -- comparar
  // su total parcial contra el año anterior COMPLETO da una caída falsa enorme.
  const deltaHojaVerde =
    hojaVerdePenultimo && ultimoAnio !== undefined && esAnioCompleto(ultimoAnio)
      ? ((hojaVerdeUltimo - hojaVerdePenultimo) / hojaVerdePenultimo) * 100
      : undefined;

  const molinoAnual = agregarSalidaMolinoAnual(filasMolino);
  const molinoMensual = agregarSalidaMolinoMensual(filasMolino);
  const molinoUltimoAnio = molinoAnual.find((f) => f.anio === ultimoAnio);
  const pctExterno = molinoUltimoAnio ? (molinoUltimoAnio.externo_kg / molinoUltimoAnio.total_kg) * 100 : 0;

  const serieHojaVerdeMensual = [...hojaVerdeMensualNacional]
    .sort((a, b) => a.anio - b.anio || a.mes - b.mes)
    .map((f) => ({ anio: f.anio, etiqueta: `${MESES[f.mes - 1].slice(0, 3)} ${String(f.anio).slice(2)}`, valor: f.hoja_verde_kg }));

  // Estacionalidad de cosecha: promedio de ingreso de hoja verde por mes
  // calendario, a través de todos los años del rango filtrado (no una serie
  // en el tiempo — por eso no usa SerieChartConFiltro, ya está agregada).
  const promedioPorMes = Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1;
    const valores = hojaVerdeMensualNacional.filter((f) => f.mes === mes).map((f) => f.hoja_verde_kg);
    const promedio = valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : 0;
    return { mes, etiqueta: MESES[i].slice(0, 3), valor: promedio * factorUnidad };
  });
  const mesPico = promedioPorMes.reduce((max, actual) => (actual.valor > max.valor ? actual : max), promedioPorMes[0]);
  const mesesCosecha = promedioPorMes.filter((m) => m.mes >= 4 && m.mes <= 9).reduce((acc, m) => acc + m.valor, 0);
  const totalPromedio = promedioPorMes.reduce((acc, m) => acc + m.valor, 0);
  const pctEnCosecha = totalPromedio > 0 ? (mesesCosecha / totalPromedio) * 100 : 0;

  const molinoStackedData = molinoAnual
    .slice()
    .reverse()
    .map((f) => ({ anio: String(f.anio), Interno: f.interno_kg * factorUnidad, Externo: f.externo_kg * factorUnidad }));

  // Elasticidad-consumo vs. actividad económica -- EMAE (INDEC) cargado desde
  // Fase 3a pero nunca antes cableado a ningún endpoint/página. Solo años
  // calendario completos (esAnioCompleto), promedio de EMAE del año (se repite
  // igual en las filas interno/externo de un mismo mes, no sesga el promedio).
  const emaePorAnio = new Map<number, number[]>();
  for (const f of filasMolino) {
    if (f.emae == null) continue;
    const arr = emaePorAnio.get(f.anio) ?? [];
    arr.push(f.emae);
    emaePorAnio.set(f.anio, arr);
  }
  const anosElasticidad = molinoAnual
    .filter((f) => esAnioCompleto(f.anio) && emaePorAnio.has(f.anio))
    .map((f) => ({
      anio: f.anio,
      interno_kg: f.interno_kg,
      emae: emaePorAnio.get(f.anio)!.reduce((a, b) => a + b, 0) / emaePorAnio.get(f.anio)!.length,
    }))
    .sort((a, b) => a.anio - b.anio);

  const elasticidadData: ElasticidadConsumoPunto[] = [];
  const yoyEmae: number[] = [];
  const yoyInterno: number[] = [];
  for (let i = 1; i < anosElasticidad.length; i++) {
    const anterior = anosElasticidad[i - 1];
    const actual = anosElasticidad[i];
    const vEmae = calcularVarPct(actual.emae, anterior.emae);
    const vInterno = calcularVarPct(actual.interno_kg, anterior.interno_kg);
    if (vEmae === null || vInterno === null) continue;
    yoyEmae.push(vEmae);
    yoyInterno.push(vInterno);
    elasticidadData.push({ anio: String(actual.anio), "EMAE (actividad económica)": vEmae, "Consumo interno (molino)": vInterno });
  }
  function correlacionPearson(x: number[], y: number[]): number | null {
    const n = x.length;
    if (n < 2) return null;
    const mediaX = x.reduce((a, b) => a + b, 0) / n;
    const mediaY = y.reduce((a, b) => a + b, 0) / n;
    const cov = x.reduce((acc, v, i) => acc + (v - mediaX) * (y[i] - mediaY), 0);
    const desvX = Math.sqrt(x.reduce((acc, v) => acc + (v - mediaX) ** 2, 0));
    const desvY = Math.sqrt(y.reduce((acc, v) => acc + (v - mediaY) ** 2, 0));
    return desvX && desvY ? cov / (desvX * desvY) : null;
  }
  const correlacionEmaeConsumo = correlacionPearson(yoyEmae, yoyInterno);
  const fuerzaCorrelacion = (r: number) => {
    const abs = Math.abs(r);
    if (abs < 0.2) return "muy débil";
    if (abs < 0.4) return "débil";
    if (abs < 0.6) return "moderada";
    return "fuerte";
  };

  const zonas = Array.from(new Set(filasHojaVerde.filter((f) => f.zona !== "TOTAL").map((f) => f.zona))).sort();
  const anios = Array.from(new Set(filasHojaVerde.map((f) => f.anio))).sort((a, b) => b - a);
  const columnasZona: ColumnaTabla<ZonaPivotRow>[] = [
    { key: "zona", label: "Zona", align: "left", format: "texto" },
    ...anios.map((anio) => ({ key: String(anio), label: String(anio), align: "right" as const, format: "entero" as const })),
  ];
  const filasZona: ZonaPivotRow[] = zonas.map((zona) => {
    const fila: ZonaPivotRow = { zona };
    for (const anio of anios) {
      const total = filasHojaVerde
        .filter((f) => f.zona === zona && f.anio === anio)
        .reduce((acc, f) => acc + f.hoja_verde_kg, 0);
      if (total > 0) fila[String(anio)] = total;
    }
    return fila;
  });

  // Mapa de calor por zona -- serie "TOTAL" nacional + las 6 zonas reales,
  // mismos nombres crudos ("ZONA CENTRO", "CORRIENTES" sin prefijo) que en
  // /predicciones, limpiados con el mismo mapeo compartido (lib/zonas.ts).
  const seriesHojaVerdeZona: HeatmapTableSerie[] = [
    {
      id: "TOTAL",
      label: "Nacional (total)",
      puntos: filasHojaVerde
        .filter((f) => f.zona === "TOTAL")
        .map((f) => ({ anio: f.anio, mes: f.mes, valor: f.hoja_verde_kg * factorUnidad })),
    },
    ...ZONAS.map((zonaLimpia) => ({
      id: zonaLimpia,
      label: etiquetaZona(zonaLimpia),
      puntos: filasHojaVerde
        .filter((f) => (ZONA_RAW_A_LIMPIA[f.zona] ?? f.zona) === zonaLimpia)
        .map((f) => ({ anio: f.anio, mes: f.mes, valor: f.hoja_verde_kg * factorUnidad })),
    })),
  ];

  // Mapa de calor de salida de molino -- 2 series (interno/externo) desde las
  // filas crudas (agregarSalidaMolinoMensual ya fusiona ambos destinos en una
  // sola fila, forma equivocada para series separadas de HeatmapTable).
  const seriesMolino: HeatmapTableSerie[] = [
    {
      id: "interno",
      label: "Mercado interno",
      puntos: filasMolino
        .filter((f) => f.destino === "interno")
        .map((f) => ({ anio: f.anio, mes: f.mes, valor: f.volumen_kg * factorUnidad })),
    },
    {
      id: "externo",
      label: "Mercado externo",
      puntos: filasMolino
        .filter((f) => f.destino === "externo")
        .map((f) => ({ anio: f.anio, mes: f.mes, valor: f.volumen_kg * factorUnidad })),
    },
  ];

  return (
    <main className="p-6 md:p-8">
      <PageHeader
        title="Cadena Productiva"
        description="Ingreso de hoja verde a secadero por zona y salida de molino (interno/externo) — fuente: reportes mensuales del INYM."
      />

      <FilterBar anios={todosLosAnios} mostrarUnidad />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label={`Hoja verde ${ultimoAnio}${ultimoAnio !== undefined && !esAnioCompleto(ultimoAnio) ? " (parcial)" : ""}`}
          value={formatMasaCompacta(hojaVerdeUltimo, unidad)}
          valorExacto={formatMasa(hojaVerdeUltimo, unidad)}
          icon={Leaf}
          deltaPct={deltaHojaVerde}
          deltaLabel={`vs. ${penultimoAnio}`}
          destacado
        />
        <KpiCard label={`Salida molino interno ${ultimoAnio}`} value={formatMasa(molinoUltimoAnio?.interno_kg ?? 0, unidad)} icon={Factory} />
        <KpiCard label={`Salida molino externo ${ultimoAnio}`} value={formatMasa(molinoUltimoAnio?.externo_kg ?? 0, unidad)} icon={Globe2} />
        <GaugeCard label="Externo de la salida de molino" valorPct={pctExterno} icon={Percent} color="var(--color-secondary)" />
      </div>

      <ChartCard
        title="Ingreso de hoja verde a secadero"
        description={`Total nacional, en ${unidad === "t" ? "toneladas" : "kilogramos"}`}
        className="mb-4"
      >
        <SerieChartConFiltro
          data={serieHojaVerdeMensual.map((p) => ({ ...p, valor: p.valor * factorUnidad }))}
          color="var(--color-primary)"
          numberFormat={{ notation: "compact" }}
          suffix={sufijoUnidad}
          estacional
        />
      </ChartCard>

      <div className="mt-8 mb-4">
        <h2 className="text-lg font-semibold text-foreground">Estacionalidad de cosecha</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Promedio de ingreso de hoja verde por mes calendario, a través de todos los años del rango seleccionado.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <KpiCard label="Mes pico de cosecha" value={mesPico.etiqueta} icon={CalendarRange} />
        <GaugeCard label="Concentración abril-septiembre" valorPct={pctEnCosecha} icon={Percent} color="var(--color-accent)" />
      </div>

      <ChartCard
        title="Ingreso de hoja verde — promedio mensual"
        description={`Total nacional, en ${unidad === "t" ? "toneladas" : "kilogramos"} — la cosecha de yerba mate se concentra entre abril y septiembre`}
        className="mb-4"
      >
        <SerieMensualChart
          data={promedioPorMes.map(({ etiqueta, valor }) => ({ etiqueta, valor }))}
          color="var(--color-accent)"
          numberFormat={{ notation: "compact" }}
          suffix={sufijoUnidad}
          estacional
        />
      </ChartCard>

      <ChartCard
        title="Salida de molino por año"
        description={`Mercado interno vs. externo, en ${unidad === "t" ? "t" : "kg"}. No coincide con consumo_interno_kg/exportaciones_kg de Producción — miden puntos distintos de la cadena.`}
        className="mb-4"
      >
        <AnnualChartConFiltro
          tipo="masa"
          unidad={unidad}
          data={molinoStackedData}
          series={[
            { key: "Interno", color: "#15803d" },
            { key: "Externo", color: "#1d4ed8" },
          ]}
        />
      </ChartCard>

      <div className="mt-8 mb-4">
        <h2 className="text-lg font-semibold text-foreground">Consumo interno vs. actividad económica</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Variación año a año del consumo interno (salida de molino) contra el EMAE (INDEC, nivel de actividad económica) —
          un bien de necesidad cotidiana debería moverse poco con los ciclos económicos.
        </p>
      </div>

      {correlacionEmaeConsumo != null ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <KpiCard
              label="Correlación EMAE ↔ consumo interno"
              value={`${formatNumero(correlacionEmaeConsumo, 2)} (${fuerzaCorrelacion(correlacionEmaeConsumo)})`}
              icon={Link2}
              secundario={`${elasticidadData.length} años completos comparados`}
            />
            <KpiCard
              label="Lectura"
              value={
                Math.abs(correlacionEmaeConsumo) < 0.4
                  ? "Consumo desacoplado del ciclo económico"
                  : "Consumo sigue el ciclo económico"
              }
              icon={Activity}
            />
          </div>
          <ChartCard
            title="EMAE vs. consumo interno — variación interanual"
            description="Ambas series en % vs. el año anterior, no en unidades absolutas."
            className="mb-4"
          >
            <ElasticidadConsumoChart data={elasticidadData} />
          </ChartCard>
        </>
      ) : (
        <NoData variant="chart" motivo="Sin años completos suficientes para calcular la correlación en el rango filtrado." className="mb-4" />
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        <ChartCard
          title="Hoja verde — histórico nacional"
          description={<>Desde {hojaVerdeAnual[hojaVerdeAnual.length - 1]?.anio} hasta {ultimoAnio}</>}
        >
          <HistoricalTable
            columnasAnual={COLUMNAS_HOJA_VERDE_ANUAL}
            filasAnual={hojaVerdeAnual}
            columnasMensual={COLUMNAS_HOJA_VERDE_MENSUAL}
            filasMensual={hojaVerdeMensualNacional}
          />
        </ChartCard>

        <ChartCard
          title="Salida de molino — histórico nacional"
          description={<>Desde {molinoAnual[molinoAnual.length - 1]?.anio} hasta {ultimoAnio}</>}
        >
          <HistoricalTable
            columnasAnual={COLUMNAS_MOLINO_ANUAL}
            filasAnual={molinoAnual}
            columnasMensual={COLUMNAS_MOLINO_MENSUAL}
            filasMensual={molinoMensual}
          />
        </ChartCard>
      </div>

      <ChartCard
        title="Hoja verde por zona"
        description={<>Kilogramos por año (excluye la fila &quot;TOTAL&quot; nacional, ya mostrada arriba)</>}
        className="mb-4"
      >
        <DataTable columnas={columnasZona} filas={filasZona} maxHeightPx={420} />
      </ChartCard>

      <ChartCard
        title="Mapa de calor — hoja verde por zona"
        description="Ingreso mensual real por zona (INYM) — elegí la zona en el selector."
        className="mb-4"
      >
        <HeatmapTable
          series={seriesHojaVerdeZona}
          selectorLabel="Zona"
          formato={{ tipo: "masa", unidad }}
        />
      </ChartCard>

      <ChartCard
        title="Mapa de calor — salida de molino"
        description="Mercado interno vs. externo, mensual real (INYM)."
        className="mb-4"
      >
        <HeatmapTable
          series={seriesMolino}
          selectorLabel="Destino"
          formato={{ tipo: "masa", unidad }}
        />
      </ChartCard>

      <FooterFuentes tablas={["ym.inym_hoja_verde_zona", "ym.inym_salida_molino", "ym.indec_series"]} />
    </main>
  );
}
