import { Package, Ship, Globe2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { ChartCard } from "@/components/chart-card";
import { FilterBar } from "@/components/filter-bar";
import { FooterFuentes } from "@/components/footer-fuentes";
import { SerieChartConFiltro } from "@/components/charts/serie-chart-con-filtro";
import { HistoricalTable } from "@/components/historical-table";
import type { ColumnaTabla } from "@/components/data-table";
import { esAnioCompleto, formatMasa, formatMasaCompacta, formatPct, type UnidadMasa } from "@/lib/format";
import { getExportacionesAnualReal, getImportacionesIndec } from "@/lib/api";
import {
  agregarComexIndecAnualNacional,
  agregarComexIndecMensualNacional,
  agregarComexIndecMensualHistorico,
  agregarComexIndecPorPais,
  type ComexAnualRow,
  type ComexIndecMensualNacionalRow,
} from "@/lib/agregaciones";

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

  const [indecCompleta, exportacionesAnualReal] = await Promise.all([getImportacionesIndec(), getExportacionesAnualReal()]);
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
        <p className="text-sm text-muted-foreground">Sin datos para los filtros seleccionados.</p>
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

  return (
    <main className="p-6 md:p-8">
      <PageHeader title="Importaciones" description="Volumen mensual importado, por país de origen (INDEC, real)." />

      <FilterBar anios={todosLosAnios} dimension={{ param: "origen", label: "Origen", opciones: todosLosOrigenes }} mostrarUnidad />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard
          label={`Importado ${ultimoAnio}${ultimoAnio !== undefined && !esAnioCompleto(ultimoAnio) ? " (parcial)" : ""}`}
          value={importadoUltimo != null ? formatMasaCompacta(importadoUltimo, unidad) : "Sin dato"}
          valorExacto={importadoUltimo != null ? formatMasa(importadoUltimo, unidad) : undefined}
          icon={Package}
          deltaPct={deltaImportado}
          deltaLabel={`vs. ${penultimoAnio}`}
          destacado
        />
        <KpiCard
          label={`Balanza comercial ${ultimoAnio}`}
          value={balanzaUltimo != null ? formatMasa(balanzaUltimo, unidad) : "Sin dato"}
          icon={Ship}
        />
        <KpiCard label="Países de origen" value={origenesDelAnio.length ? String(origenesDelAnio.length) : "Sin dato"} icon={Globe2} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <ChartCard
          title="Volumen importado mensual"
          description={`Suma de ${origenFiltro ?? "todos los orígenes"} (INDEC, real), en ${unidad === "t" ? "toneladas" : "kilogramos"}`}
          className="xl:col-span-2"
        >
          <SerieChartConFiltro
            data={serieMensual.map((p) => ({ anio: p.anio, etiqueta: p.etiqueta, valor: p.produccion_kg * factorUnidad }))}
            color="#1d4ed8"
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
