import { Ship, Globe2, DollarSign, TrendingUp, Package } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { FilterBar } from "@/components/filter-bar";
import { SerieMensualChart } from "@/components/charts/serie-mensual-chart";
import { HistoricalTable } from "@/components/historical-table";
import type { ColumnaTabla } from "@/components/data-table";
import { formatKg, formatNumero, formatPct, formatUsd } from "@/lib/format";
import { getExportaciones, getImportaciones } from "@/lib/api";
import {
  agregarExportacionesAnual,
  agregarExportacionesMensual,
  agregarImportacionesAnual,
  type ExportacionAnualRow,
  type ExportacionMensualRow,
  type ImportacionAnualRow,
} from "@/lib/agregaciones";
import type { ImportacionRow } from "@/lib/types";

const COLUMNAS_ANUAL: ColumnaTabla<ExportacionAnualRow>[] = [
  { key: "anio", label: "Año", align: "left" },
  { key: "volumen_kg", label: "Volumen (kg)", align: "right", format: "entero" },
  { key: "valor_fob_usd", label: "Valor FOB", align: "right", format: "usd" },
  { key: "precio_fob_usd_kg_promedio", label: "Precio prom. FOB USD/kg", align: "right", format: "decimal2" },
];

const COLUMNAS_MENSUAL: ColumnaTabla<ExportacionMensualRow>[] = [
  { key: "anio", label: "Año", align: "left" },
  { key: "mes_nombre", label: "Mes", align: "left" },
  { key: "volumen_kg", label: "Volumen (kg)", align: "right", format: "entero" },
  { key: "valor_fob_usd", label: "Valor FOB", align: "right", format: "usd" },
  { key: "precio_fob_usd_kg_promedio", label: "Precio prom. FOB USD/kg", align: "right", format: "decimal2" },
];

const COLUMNAS_IMPORTACIONES_ANUAL: ColumnaTabla<ImportacionAnualRow>[] = [
  { key: "anio", label: "Año", align: "left" },
  { key: "volumen_kg", label: "Volumen (kg)", align: "right", format: "entero" },
];

const COLUMNAS_IMPORTACIONES_MENSUAL: ColumnaTabla<ImportacionRow>[] = [
  { key: "anio", label: "Año", align: "left" },
  { key: "mes_nombre", label: "Mes", align: "left" },
  { key: "volumen_kg", label: "Volumen (kg)", align: "right", format: "entero" },
];

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
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

  const [filasCompletas, filasImportacionesCompletas] = await Promise.all([getExportaciones(), getImportaciones()]);
  const todosLosAnios = Array.from(new Set(filasCompletas.map((f) => f.anio))).sort((a, b) => a - b);
  const todosLosDestinos = Array.from(new Set(filasCompletas.map((f) => f.destino))).sort();

  const filas = filasCompletas.filter(
    (f) =>
      (!anioDesde || f.anio >= anioDesde) &&
      (!anioHasta || f.anio <= anioHasta) &&
      (!destinoFiltro || f.destino === destinoFiltro)
  );
  const filasImportaciones = filasImportacionesCompletas.filter(
    (f) => (!anioDesde || f.anio >= anioDesde) && (!anioHasta || f.anio <= anioHasta)
  );

  const anios = Array.from(new Set(filas.map((f) => f.anio))).sort((a, b) => a - b);
  const ultimoAnio = anios[anios.length - 1];
  const penultimoAnio = anios[anios.length - 2];

  const filasUltimoAnio = filas.filter((f) => f.anio === ultimoAnio);
  const filasPenultimoAnio = filas.filter((f) => f.anio === penultimoAnio);
  const volumenUltimo = filasUltimoAnio.reduce((acc, f) => acc + f.volumen_kg, 0);
  const volumenPenultimo = filasPenultimoAnio.reduce((acc, f) => acc + f.volumen_kg, 0);
  const deltaVolumen = volumenPenultimo ? ((volumenUltimo - volumenPenultimo) / volumenPenultimo) * 100 : undefined;
  const valorFobUltimo = filasUltimoAnio.reduce((acc, f) => acc + f.valor_fob_usd, 0);
  const precioPromedioUltimo = valorFobUltimo / volumenUltimo;

  const porDestino = new Map<string, number>();
  for (const f of filasUltimoAnio) {
    porDestino.set(f.destino, (porDestino.get(f.destino) ?? 0) + f.volumen_kg);
  }
  const destinos = Array.from(porDestino.entries())
    .map(([destino, volumen_kg]) => ({ destino, volumen_kg, porcentaje: (volumen_kg / volumenUltimo) * 100 }))
    .sort((a, b) => b.volumen_kg - a.volumen_kg);

  const totales = new Map<string, number>();
  for (const f of filas) {
    const clave = `${f.anio}-${String(f.mes).padStart(2, "0")}`;
    totales.set(clave, (totales.get(clave) ?? 0) + f.volumen_kg);
  }
  const serieMensual = Array.from(totales.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([clave, volumen_kg]) => {
      const [anio, mes] = clave.split("-");
      return { etiqueta: `${MESES[Number(mes) - 1].slice(0, 3)} ${anio.slice(2)}`, valor: volumen_kg };
    });

  const anualHistorico = agregarExportacionesAnual(filas);
  const mensualHistorico = agregarExportacionesMensual(filas);

  const importacionesAnualHistorico = agregarImportacionesAnual(filasImportaciones);
  const importacionesMensualHistorico = [...filasImportaciones].sort((a, b) => b.anio - a.anio || b.mes - a.mes);
  const importadoUltimo = importacionesAnualHistorico.find((f) => f.anio === ultimoAnio)?.volumen_kg ?? 0;
  const importadoPenultimo = importacionesAnualHistorico.find((f) => f.anio === penultimoAnio)?.volumen_kg ?? 0;
  const deltaImportado = importadoPenultimo ? ((importadoUltimo - importadoPenultimo) / importadoPenultimo) * 100 : undefined;
  const balanzaUltimo = volumenUltimo - importadoUltimo;

  return (
    <main className="p-6 md:p-8">
      <PageHeader
        title="Exportaciones"
        description="Volumen y valor FOB por país destino, evolución histórica."
      />

      <FilterBar anios={todosLosAnios} dimension={{ param: "destino", label: "Destino", opciones: todosLosDestinos }} />

      {filas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin datos para los filtros seleccionados.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KpiCard label={`Volumen exportado ${ultimoAnio}`} value={formatKg(volumenUltimo)} icon={Ship} deltaPct={deltaVolumen} deltaLabel={`vs. ${penultimoAnio}`} />
            <KpiCard label={`Valor FOB ${ultimoAnio}`} value={formatUsd(valorFobUltimo)} icon={DollarSign} />
            <KpiCard label="Precio FOB promedio USD/kg" value={formatNumero(precioPromedioUltimo, 2)} icon={TrendingUp} />
            <KpiCard label="Países destino" value={String(destinos.length)} icon={Globe2} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2 rounded-xl border border-border bg-card p-4">
              <h2 className="text-sm font-semibold text-card-foreground mb-1">Volumen exportado mensual</h2>
              <p className="text-xs text-muted-foreground mb-3">Suma de {destinoFiltro ?? "todos los destinos"}, en kilogramos</p>
              <SerieMensualChart
                data={serieMensual}
                numberFormat={{ notation: "compact" }}
                suffix=" kg"
              />
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="text-sm font-semibold text-card-foreground mb-1">Distribución por destino ({ultimoAnio})</h2>
              <p className="text-xs text-muted-foreground mb-3">% del volumen total exportado</p>
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
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-card-foreground mb-1">Histórico completo</h2>
            <p className="text-xs text-muted-foreground mb-3">
              Total {destinoFiltro ?? "nacional (todos los destinos)"}, desde {anualHistorico[anualHistorico.length - 1]?.anio} hasta {ultimoAnio}
            </p>
            <HistoricalTable
              columnasAnual={COLUMNAS_ANUAL}
              filasAnual={anualHistorico}
              columnasMensual={COLUMNAS_MENSUAL}
              filasMensual={mensualHistorico}
            />
          </div>

          <div className="mt-8 mb-4">
            <h2 className="text-lg font-semibold text-foreground">Importaciones</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Volumen mensual importado, sin desagregar por origen.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <KpiCard
              label={`Importado ${ultimoAnio}`}
              value={formatKg(importadoUltimo)}
              icon={Package}
              deltaPct={deltaImportado}
              deltaLabel={`vs. ${penultimoAnio}`}
            />
            <KpiCard
              label={`Balanza comercial ${ultimoAnio}`}
              value={formatKg(balanzaUltimo)}
              icon={Ship}
            />
            <KpiCard label="Años con datos" value={String(importacionesAnualHistorico.length)} icon={Globe2} />
          </div>

          <div className="rounded-xl border border-border bg-card p-4 mb-4">
            <h3 className="text-sm font-semibold text-card-foreground mb-1">Volumen importado mensual</h3>
            <p className="text-xs text-muted-foreground mb-3">Kilogramos</p>
            <SerieMensualChart
              data={[...importacionesMensualHistorico]
                .sort((a, b) => a.anio - b.anio || a.mes - b.mes)
                .map((f) => ({ etiqueta: `${f.mes_nombre.slice(0, 3)} ${String(f.anio).slice(2)}`, valor: f.volumen_kg }))}
              color="#1d4ed8"
              numberFormat={{ notation: "compact" }}
              suffix=" kg"
            />
          </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-card-foreground mb-1">Histórico completo</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Desde {importacionesAnualHistorico[importacionesAnualHistorico.length - 1]?.anio} hasta {ultimoAnio}
        </p>
        <HistoricalTable
              columnasAnual={COLUMNAS_IMPORTACIONES_ANUAL}
              filasAnual={importacionesAnualHistorico}
              columnasMensual={COLUMNAS_IMPORTACIONES_MENSUAL}
              filasMensual={importacionesMensualHistorico}
            />
          </div>
        </>
      )}
    </main>
  );
}
