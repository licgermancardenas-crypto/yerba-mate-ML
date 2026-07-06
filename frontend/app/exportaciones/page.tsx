import { Ship, Globe2, DollarSign, TrendingUp, PieChart, Package2, Boxes, HelpCircle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { GaugeCard } from "@/components/gauge-card";
import { ChartCard } from "@/components/chart-card";
import { FilterBar } from "@/components/filter-bar";
import { SerieChartConFiltro } from "@/components/charts/serie-chart-con-filtro";
import { HistoricalTable } from "@/components/historical-table";
import type { ColumnaTabla } from "@/components/data-table";
import { formatMasa, formatNumero, formatPct, formatUsd, type UnidadMasa } from "@/lib/format";
import { getExportaciones } from "@/lib/api";
import {
  agregarExportacionesAnual,
  agregarExportacionesMensual,
  type ExportacionAnualRow,
  type ExportacionMensualRow,
} from "@/lib/agregaciones";

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
  const unidad: UnidadMasa = sp.unidad === "t" ? "t" : "kg";
  const sufijoUnidad = unidad === "t" ? " t" : " kg";
  const factorUnidad = unidad === "t" ? 1 / 1000 : 1;

  const filasCompletas = await getExportaciones();
  const todosLosAnios = Array.from(new Set(filasCompletas.map((f) => f.anio))).sort((a, b) => a - b);
  const todosLosDestinos = Array.from(new Set(filasCompletas.map((f) => f.destino))).sort();

  const filas = filasCompletas.filter(
    (f) =>
      (!anioDesde || f.anio >= anioDesde) &&
      (!anioHasta || f.anio <= anioHasta) &&
      (!destinoFiltro || f.destino === destinoFiltro)
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
      return { anio: Number(anio), etiqueta: `${MESES[Number(mes) - 1].slice(0, 3)} ${anio.slice(2)}`, valor: volumen_kg };
    });

  const anualHistorico = agregarExportacionesAnual(filas);
  const mensualHistorico = agregarExportacionesMensual(filas);

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
            <KpiCard label={`Volumen exportado ${ultimoAnio}`} value={formatMasa(volumenUltimo, unidad)} icon={Ship} deltaPct={deltaVolumen} deltaLabel={`vs. ${penultimoAnio}`} destacado />
            <KpiCard label={`Valor FOB ${ultimoAnio}`} value={formatUsd(valorFobUltimo)} icon={DollarSign} />
            <KpiCard label="Precio FOB promedio USD/kg" value={formatNumero(precioPromedioUltimo, 2)} icon={TrendingUp} />
            <KpiCard label="Países destino" value={String(destinos.length)} icon={Globe2} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <ChartCard
              title="Volumen exportado mensual"
              description={`Suma de ${destinoFiltro ?? "todos los destinos"}, en ${unidad === "t" ? "toneladas" : "kilogramos"}`}
              className="xl:col-span-2"
            >
              <SerieChartConFiltro
                data={serieMensual.map((p) => ({ ...p, valor: p.valor * factorUnidad }))}
                numberFormat={{ notation: "compact" }}
                suffix={sufijoUnidad}
              />
            </ChartCard>

            <ChartCard title={`Distribución por destino (${ultimoAnio})`} description="% del volumen total exportado">
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
            </ChartCard>
          </div>

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
            title="Histórico completo"
            className="mt-8"
            description={
              <>
                Total {destinoFiltro ?? "nacional (todos los destinos)"}, desde {anualHistorico[anualHistorico.length - 1]?.anio} hasta {ultimoAnio}
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
        </>
      )}
    </main>
  );
}
