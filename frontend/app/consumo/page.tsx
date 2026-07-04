import { Coffee, Package, ScrollText } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { SerieMensualChart } from "@/components/charts/serie-mensual-chart";
import { EnvasesStackedChart, type EnvasesPunto } from "@/components/charts/envases-stacked-chart";
import { formatNumero } from "@/lib/format";
import { getConsumoMock } from "@/lib/mock-data";

export default function ConsumoPage() {
  const filas = getConsumoMock();

  const porAnio = new Map<number, (typeof filas)[number]>();
  for (const fila of filas) {
    if (!porAnio.has(fila.anio)) porAnio.set(fila.anio, fila);
  }
  const anios = Array.from(porAnio.keys()).sort();

  const serieAnual = anios.map((anio) => ({
    etiqueta: String(anio),
    valor: porAnio.get(anio)!.consumo_per_capita_kg,
  }));

  const envasesPorAnio: EnvasesPunto[] = anios.map((anio) => {
    const f = porAnio.get(anio)!;
    return {
      anio: String(anio),
      "1/4 kg": f.envase_025kg_pct,
      "1/2 kg": f.envase_05kg_pct,
      "1 kg": f.envase_1kg_pct,
      "2 kg": f.envase_2kg_pct,
      Otros: f.otros_envases_pct,
      "Sin estampilla": f.sin_estampillas_pct,
    };
  });

  const ultimoAnio = anios[anios.length - 1];
  const penultimoAnio = anios[anios.length - 2];
  const consumoUltimo = porAnio.get(ultimoAnio)!.consumo_per_capita_kg;
  const consumoPenultimo = porAnio.get(penultimoAnio)!.consumo_per_capita_kg;
  const deltaConsumo = ((consumoUltimo - consumoPenultimo) / consumoPenultimo) * 100;

  return (
    <main className="p-6 md:p-8">
      <PageHeader
        title="Consumo"
        description="Consumo per cápita y mix de envases en el mercado interno. Datos de muestra — se conecta a la API real cuando la base esté cargada."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard
          label={`Consumo per cápita ${ultimoAnio}`}
          value={`${formatNumero(consumoUltimo, 2)} kg/persona`}
          icon={Coffee}
          deltaPct={deltaConsumo}
          deltaLabel={`vs. ${penultimoAnio}`}
        />
        <KpiCard
          label="Formato preferido"
          value="Medio kilo"
          icon={Package}
        />
        <KpiCard
          label="Sin estampilla"
          value={`${formatNumero(porAnio.get(ultimoAnio)!.sin_estampillas_pct, 1)}%`}
          icon={ScrollText}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-card-foreground mb-1">Consumo per cápita por año</h2>
          <p className="text-xs text-muted-foreground mb-3">Kilogramos por persona por año</p>
          <SerieMensualChart
            data={serieAnual}
            formatValor={(v) => `${v.toFixed(1)}`}
          />
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-card-foreground mb-1">Mix de envases por año</h2>
          <p className="text-xs text-muted-foreground mb-3">% de las salidas de molino al mercado interno</p>
          <EnvasesStackedChart data={envasesPorAnio} />
        </div>
      </div>
    </main>
  );
}
