import { Leaf, Factory, Globe2, Percent } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { FilterBar } from "@/components/filter-bar";
import { SerieChartConFiltro } from "@/components/charts/serie-chart-con-filtro";
import { AnnualChartConFiltro } from "@/components/charts/annual-chart-con-filtro";
import { HistoricalTable } from "@/components/historical-table";
import { DataTable, type ColumnaTabla } from "@/components/data-table";
import { formatMasa, formatPct, type UnidadMasa } from "@/lib/format";
import { getHojaVerde, getSalidaMolino } from "@/lib/api";
import {
  agregarHojaVerdeAnual,
  agregarSalidaMolinoAnual,
  agregarSalidaMolinoMensual,
  type HojaVerdeAnualRow,
  type SalidaMolinoAnualRow,
  type SalidaMolinoMensualRow,
} from "@/lib/agregaciones";
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
        <p className="text-sm text-muted-foreground">Sin datos para los filtros seleccionados.</p>
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
  const deltaHojaVerde = hojaVerdePenultimo ? ((hojaVerdeUltimo - hojaVerdePenultimo) / hojaVerdePenultimo) * 100 : undefined;

  const molinoAnual = agregarSalidaMolinoAnual(filasMolino);
  const molinoMensual = agregarSalidaMolinoMensual(filasMolino);
  const molinoUltimoAnio = molinoAnual.find((f) => f.anio === ultimoAnio);
  const pctExterno = molinoUltimoAnio ? (molinoUltimoAnio.externo_kg / molinoUltimoAnio.total_kg) * 100 : 0;

  const serieHojaVerdeMensual = [...hojaVerdeMensualNacional]
    .sort((a, b) => a.anio - b.anio || a.mes - b.mes)
    .map((f) => ({ anio: f.anio, etiqueta: `${MESES[f.mes - 1].slice(0, 3)} ${String(f.anio).slice(2)}`, valor: f.hoja_verde_kg }));

  const molinoStackedData = molinoAnual
    .slice()
    .reverse()
    .map((f) => ({ anio: String(f.anio), Interno: f.interno_kg * factorUnidad, Externo: f.externo_kg * factorUnidad }));

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

  return (
    <main className="p-6 md:p-8">
      <PageHeader
        title="Cadena Productiva"
        description="Ingreso de hoja verde a secadero por zona y salida de molino (interno/externo) — fuente: reportes mensuales del INYM."
      />

      <FilterBar anios={todosLosAnios} mostrarUnidad />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label={`Hoja verde ${ultimoAnio}`}
          value={formatMasa(hojaVerdeUltimo, unidad)}
          icon={Leaf}
          deltaPct={deltaHojaVerde}
          deltaLabel={`vs. ${penultimoAnio}`}
        />
        <KpiCard label={`Salida molino interno ${ultimoAnio}`} value={formatMasa(molinoUltimoAnio?.interno_kg ?? 0, unidad)} icon={Factory} />
        <KpiCard label={`Salida molino externo ${ultimoAnio}`} value={formatMasa(molinoUltimoAnio?.externo_kg ?? 0, unidad)} icon={Globe2} />
        <KpiCard label="% externo de la salida de molino" value={formatPct(pctExterno)} icon={Percent} />
      </div>

      <div className="rounded-xl border border-border bg-card p-4 mb-4">
        <h2 className="text-sm font-semibold text-card-foreground mb-1">Ingreso de hoja verde a secadero</h2>
        <p className="text-xs text-muted-foreground mb-3">Total nacional, en {unidad === "t" ? "toneladas" : "kilogramos"}</p>
        <SerieChartConFiltro
          data={serieHojaVerdeMensual.map((p) => ({ ...p, valor: p.valor * factorUnidad }))}
          color="#15803d"
          numberFormat={{ notation: "compact" }}
          suffix={sufijoUnidad}
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-4 mb-4">
        <h2 className="text-sm font-semibold text-card-foreground mb-1">Salida de molino por año</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Mercado interno vs. externo, en {unidad === "t" ? "t" : "kg"}. No coincide con consumo_interno_kg/exportaciones_kg de Producción — miden puntos distintos de la cadena.
        </p>
        <AnnualChartConFiltro
          tipo="cuotas"
          data={molinoStackedData}
          series={[
            { key: "Interno", color: "#15803d" },
            { key: "Externo", color: "#1d4ed8" },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-card-foreground mb-1">Hoja verde — histórico nacional</h2>
          <p className="text-xs text-muted-foreground mb-3">
            Desde {hojaVerdeAnual[hojaVerdeAnual.length - 1]?.anio} hasta {ultimoAnio}
          </p>
          <HistoricalTable
            columnasAnual={COLUMNAS_HOJA_VERDE_ANUAL}
            filasAnual={hojaVerdeAnual}
            columnasMensual={COLUMNAS_HOJA_VERDE_MENSUAL}
            filasMensual={hojaVerdeMensualNacional}
          />
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-card-foreground mb-1">Salida de molino — histórico nacional</h2>
          <p className="text-xs text-muted-foreground mb-3">
            Desde {molinoAnual[molinoAnual.length - 1]?.anio} hasta {ultimoAnio}
          </p>
          <HistoricalTable
            columnasAnual={COLUMNAS_MOLINO_ANUAL}
            filasAnual={molinoAnual}
            columnasMensual={COLUMNAS_MOLINO_MENSUAL}
            filasMensual={molinoMensual}
          />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-card-foreground mb-1">Hoja verde por zona</h2>
        <p className="text-xs text-muted-foreground mb-3">Kilogramos por año (excluye la fila &quot;TOTAL&quot; nacional, ya mostrada arriba)</p>
        <DataTable columnas={columnasZona} filas={filasZona} maxHeightPx={420} />
      </div>
    </main>
  );
}
