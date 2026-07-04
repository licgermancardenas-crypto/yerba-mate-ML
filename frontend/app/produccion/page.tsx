import { Sprout, Wheat, TrendingUp, DollarSign } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { SerieMensualChart } from "@/components/charts/serie-mensual-chart";
import { formatKg, formatNumero, formatPct, formatUsd } from "@/lib/format";
import { getProduccionMock, agregarProduccionMensual, agregarProduccionPorCiudad } from "@/lib/mock-data";

export default function ProduccionPage() {
  const filas = getProduccionMock();
  const serieMensual = agregarProduccionMensual(filas).slice(-24);
  const porCiudad2025 = agregarProduccionPorCiudad(filas, 2025);
  const porCiudad2024 = agregarProduccionPorCiudad(filas, 2024);

  const total2025 = porCiudad2025.reduce((acc, r) => acc + r.produccion_kg, 0);
  const total2024 = porCiudad2024.reduce((acc, r) => acc + r.produccion_kg, 0);
  const deltaAnual = ((total2025 - total2024) / total2024) * 100;

  const exportado2025 = filas
    .filter((f) => f.anio === 2025)
    .reduce((acc, f) => acc + f.exportaciones_kg, 0);
  const valorFob2025 = filas
    .filter((f) => f.anio === 2025)
    .reduce((acc, f) => acc + f.valor_fob_usd, 0);
  const precioPromedio2025 =
    filas.filter((f) => f.anio === 2025).reduce((acc, f) => acc + f.precio_usd_kg, 0) /
    filas.filter((f) => f.anio === 2025).length;

  return (
    <main className="p-6 md:p-8">
      <PageHeader
        title="Producción"
        description="Serie mensual y distribución geográfica de la producción de yerba mate elaborada. Datos de muestra — se conecta a la API real cuando la base esté cargada."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Producción 2025" value={formatKg(total2025)} icon={Sprout} deltaPct={deltaAnual} deltaLabel="vs. 2024" />
        <KpiCard label="Exportado 2025" value={formatKg(exportado2025)} icon={Wheat} />
        <KpiCard label="Precio promedio USD/kg" value={formatNumero(precioPromedio2025, 2)} icon={TrendingUp} />
        <KpiCard label="Valor FOB exportado 2025" value={formatUsd(valorFob2025)} icon={DollarSign} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-card-foreground mb-1">Producción nacional mensual (últimos 24 meses)</h2>
          <p className="text-xs text-muted-foreground mb-3">Suma de las 7 ciudades productoras, en kilogramos</p>
          <SerieMensualChart
            data={serieMensual.map((p) => ({ etiqueta: p.etiqueta, valor: p.produccion_kg }))}
            formatValor={(v) => new Intl.NumberFormat("es-AR", { notation: "compact" }).format(v)}
          />
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-card-foreground mb-1">Distribución por ciudad (2025)</h2>
          <p className="text-xs text-muted-foreground mb-3">% del total nacional</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="font-medium py-2">Ciudad</th>
                <th className="font-medium py-2 text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {porCiudad2025.map((fila) => (
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
    </main>
  );
}
