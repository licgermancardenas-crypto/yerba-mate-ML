import { Ship, Globe2, DollarSign, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { SerieMensualChart } from "@/components/charts/serie-mensual-chart";
import { formatKg, formatNumero, formatPct, formatUsd } from "@/lib/format";
import { getExportaciones } from "@/lib/api";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export default async function ExportacionesPage() {
  const filas = await getExportaciones();
  const anios = Array.from(new Set(filas.map((f) => f.anio))).sort((a, b) => a - b);
  const ultimoAnio = anios[anios.length - 1];
  const penultimoAnio = anios[anios.length - 2];

  const filasUltimoAnio = filas.filter((f) => f.anio === ultimoAnio);
  const filasPenultimoAnio = filas.filter((f) => f.anio === penultimoAnio);
  const volumenUltimo = filasUltimoAnio.reduce((acc, f) => acc + f.volumen_kg, 0);
  const volumenPenultimo = filasPenultimoAnio.reduce((acc, f) => acc + f.volumen_kg, 0);
  const deltaVolumen = ((volumenUltimo - volumenPenultimo) / volumenPenultimo) * 100;
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
    })
    .slice(-24);

  return (
    <main className="p-6 md:p-8">
      <PageHeader
        title="Exportaciones"
        description="Volumen y valor FOB por país destino, evolución histórica."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label={`Volumen exportado ${ultimoAnio}`} value={formatKg(volumenUltimo)} icon={Ship} deltaPct={deltaVolumen} deltaLabel={`vs. ${penultimoAnio}`} />
        <KpiCard label={`Valor FOB ${ultimoAnio}`} value={formatUsd(valorFobUltimo)} icon={DollarSign} />
        <KpiCard label="Precio FOB promedio USD/kg" value={formatNumero(precioPromedioUltimo, 2)} icon={TrendingUp} />
        <KpiCard label="Países destino" value={String(destinos.length)} icon={Globe2} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-card-foreground mb-1">Volumen exportado mensual (últimos 24 meses)</h2>
          <p className="text-xs text-muted-foreground mb-3">Suma de todos los destinos, en kilogramos</p>
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
    </main>
  );
}
