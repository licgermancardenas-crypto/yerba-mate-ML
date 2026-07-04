import { Sprout, Wheat, TrendingUp, DollarSign } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { FilterBar } from "@/components/filter-bar";
import { SerieMensualChart } from "@/components/charts/serie-mensual-chart";
import { HistoricalTable } from "@/components/historical-table";
import type { ColumnaTabla } from "@/components/data-table";
import { formatKg, formatNumero, formatPct, formatUsd } from "@/lib/format";
import { getProduccion } from "@/lib/api";
import {
  agregarProduccionMensual,
  agregarProduccionPorCiudad,
  agregarProduccionAnual,
  agregarProduccionMensualNacional,
  type ProduccionAnualRow,
  type ProduccionMensualNacionalRow,
} from "@/lib/agregaciones";

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

  const filasCompletas = await getProduccion();
  const todosLosAnios = Array.from(new Set(filasCompletas.map((f) => f.anio))).sort((a, b) => a - b);
  const todasLasProvincias = Array.from(new Set(filasCompletas.map((f) => f.provincia))).sort();

  const filas = filasCompletas.filter(
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

  return (
    <main className="p-6 md:p-8">
      <PageHeader
        title="Producción"
        description="Serie mensual y distribución geográfica de la producción de yerba mate elaborada."
      />

      <FilterBar anios={todosLosAnios} dimension={{ param: "provincia", label: "Provincia", opciones: todasLasProvincias }} />

      {filas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin datos para los filtros seleccionados.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KpiCard label={`Producción ${ultimoAnio}`} value={formatKg(totalUltimo)} icon={Sprout} deltaPct={deltaAnual} deltaLabel={`vs. ${penultimoAnio}`} />
            <KpiCard label={`Exportado ${ultimoAnio}`} value={formatKg(exportadoUltimo)} icon={Wheat} />
            <KpiCard label="Precio promedio USD/kg" value={formatNumero(precioPromedioUltimo, 2)} icon={TrendingUp} />
            <KpiCard label={`Valor FOB exportado ${ultimoAnio}`} value={formatUsd(valorFobUltimo)} icon={DollarSign} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2 rounded-xl border border-border bg-card p-4">
              <h2 className="text-sm font-semibold text-card-foreground mb-1">Producción nacional mensual</h2>
              <p className="text-xs text-muted-foreground mb-3">Suma de las ciudades productoras, en kilogramos</p>
              <SerieMensualChart
                data={serieMensual.map((p) => ({ etiqueta: p.etiqueta, valor: p.produccion_kg }))}
                numberFormat={{ notation: "compact" }}
                suffix=" kg"
              />
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="text-sm font-semibold text-card-foreground mb-1">Distribución por ciudad ({ultimoAnio})</h2>
              <p className="text-xs text-muted-foreground mb-3">% del total nacional</p>
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
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-card-foreground mb-1">Histórico completo</h2>
            <p className="text-xs text-muted-foreground mb-3">
              Total {provinciaFiltro ?? "nacional"} (suma de {provinciaFiltro ? "las ciudades de la provincia" : "todas las ciudades productoras"}), desde{" "}
              {anualHistorico[anualHistorico.length - 1]?.anio} hasta {ultimoAnio}
            </p>
            <HistoricalTable
              columnasAnual={COLUMNAS_ANUAL}
              filasAnual={anualHistorico}
              columnasMensual={COLUMNAS_MENSUAL}
              filasMensual={mensualHistorico}
            />
          </div>
        </>
      )}
    </main>
  );
}
