import { Package, Ship, Globe2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { ChartCard } from "@/components/chart-card";
import { FilterBar } from "@/components/filter-bar";
import { SerieChartConFiltro } from "@/components/charts/serie-chart-con-filtro";
import { HistoricalTable } from "@/components/historical-table";
import type { ColumnaTabla } from "@/components/data-table";
import { formatMasa, type UnidadMasa } from "@/lib/format";
import { getExportaciones, getImportaciones } from "@/lib/api";
import { agregarImportacionesAnual, type ImportacionAnualRow } from "@/lib/agregaciones";
import type { ImportacionRow } from "@/lib/types";

const COLUMNAS_ANUAL: ColumnaTabla<ImportacionAnualRow>[] = [
  { key: "anio", label: "Año", align: "left" },
  { key: "volumen_kg", label: "Volumen (kg)", align: "right", format: "entero" },
];

const COLUMNAS_MENSUAL: ColumnaTabla<ImportacionRow>[] = [
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
  const unidad: UnidadMasa = sp.unidad === "t" ? "t" : "kg";
  const sufijoUnidad = unidad === "t" ? " t" : " kg";
  const factorUnidad = unidad === "t" ? 1 / 1000 : 1;

  const [filasImportacionesCompletas, filasExportacionesCompletas] = await Promise.all([
    getImportaciones(),
    getExportaciones(),
  ]);
  const todosLosAnios = Array.from(new Set(filasImportacionesCompletas.map((f) => f.anio))).sort((a, b) => a - b);

  const filas = filasImportacionesCompletas.filter(
    (f) => (!anioDesde || f.anio >= anioDesde) && (!anioHasta || f.anio <= anioHasta)
  );

  if (filas.length === 0) {
    return (
      <main className="p-6 md:p-8">
        <PageHeader title="Importaciones" description="Volumen mensual importado, sin desagregar por origen." />
        <FilterBar anios={todosLosAnios} mostrarUnidad />
        <p className="text-sm text-muted-foreground">Sin datos para los filtros seleccionados.</p>
      </main>
    );
  }

  const anios = Array.from(new Set(filas.map((f) => f.anio))).sort((a, b) => a - b);
  const ultimoAnio = anios[anios.length - 1];
  const penultimoAnio = anios[anios.length - 2];

  const anualHistorico = agregarImportacionesAnual(filas);
  const mensualHistorico = [...filas].sort((a, b) => b.anio - a.anio || b.mes - a.mes);

  const importadoUltimo = anualHistorico.find((f) => f.anio === ultimoAnio)?.volumen_kg ?? 0;
  const importadoPenultimo = anualHistorico.find((f) => f.anio === penultimoAnio)?.volumen_kg ?? 0;
  const deltaImportado = importadoPenultimo ? ((importadoUltimo - importadoPenultimo) / importadoPenultimo) * 100 : undefined;

  const exportadoUltimo = filasExportacionesCompletas
    .filter((f) => f.anio === ultimoAnio)
    .reduce((acc, f) => acc + f.volumen_kg, 0);
  const balanzaUltimo = exportadoUltimo - importadoUltimo;

  return (
    <main className="p-6 md:p-8">
      <PageHeader title="Importaciones" description="Volumen mensual importado, sin desagregar por origen." />

      <FilterBar anios={todosLosAnios} mostrarUnidad />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard
          label={`Importado ${ultimoAnio}`}
          value={formatMasa(importadoUltimo, unidad)}
          icon={Package}
          deltaPct={deltaImportado}
          deltaLabel={`vs. ${penultimoAnio}`}
          destacado
        />
        <KpiCard
          label={`Balanza comercial ${ultimoAnio}`}
          value={formatMasa(balanzaUltimo, unidad)}
          icon={Ship}
        />
        <KpiCard label="Años con datos" value={String(anualHistorico.length)} icon={Globe2} />
      </div>

      <ChartCard title="Volumen importado mensual" description={unidad === "t" ? "Toneladas" : "Kilogramos"} className="mb-4">
        <SerieChartConFiltro
          data={[...mensualHistorico]
            .sort((a, b) => a.anio - b.anio || a.mes - b.mes)
            .map((f) => ({ anio: f.anio, etiqueta: `${f.mes_nombre.slice(0, 3)} ${String(f.anio).slice(2)}`, valor: f.volumen_kg * factorUnidad }))}
          color="#1d4ed8"
          numberFormat={{ notation: "compact" }}
          suffix={sufijoUnidad}
        />
      </ChartCard>

      <ChartCard
        title="Histórico completo"
        description={
          <>Desde {anualHistorico[anualHistorico.length - 1]?.anio} hasta {ultimoAnio}</>
        }
      >
        <HistoricalTable
          columnasAnual={COLUMNAS_ANUAL}
          filasAnual={anualHistorico}
          columnasMensual={COLUMNAS_MENSUAL}
          filasMensual={mensualHistorico}
        />
      </ChartCard>
    </main>
  );
}
