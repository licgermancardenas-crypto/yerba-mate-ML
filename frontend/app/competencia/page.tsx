import { Users, Crown, Building2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { CuotasStackedChart } from "@/components/charts/cuotas-stacked-chart";
import { DataTable, type ColumnaTabla } from "@/components/data-table";
import { formatPct } from "@/lib/format";
import { getCompetencia } from "@/lib/api";

type EmpresaPivotRow = { empresa: string } & Record<string, string | number>;

const COLORES = ["#15803d", "#22c55e", "#a16207", "#65a30d", "#94a3b8"];
const TOP_N = 4;

export default async function CompetenciaPage() {
  const filas = await getCompetencia();
  const anios = Array.from(new Set(filas.map((f) => f.anio))).sort((a, b) => a - b);
  const ultimoAnio = anios[anios.length - 1];

  const filasUltimoAnio = filas
    .filter((f) => f.anio === ultimoAnio)
    .sort((a, b) => b.cuota_mercado_pct - a.cuota_mercado_pct);
  const topEmpresas = filasUltimoAnio.filter((f) => f.empresa !== "Others").slice(0, TOP_N).map((f) => f.empresa);

  const series = [...topEmpresas.map((empresa, i) => ({ key: empresa, color: COLORES[i] })), { key: "Otras", color: COLORES[COLORES.length - 1] }];

  const data = anios.map((anio) => {
    const filasAnio = filas.filter((f) => f.anio === anio);
    const fila: Record<string, string | number> = { anio: String(anio) };
    let otras = 0;
    for (const f of filasAnio) {
      if (topEmpresas.includes(f.empresa)) {
        fila[f.empresa] = f.cuota_mercado_pct;
      } else {
        otras += f.cuota_mercado_pct;
      }
    }
    fila["Otras"] = Number(otras.toFixed(2));
    return fila;
  });

  const lider = filasUltimoAnio[0];
  const cuotaTop4 = topEmpresas.reduce(
    (acc, empresa) => acc + (filasUltimoAnio.find((f) => f.empresa === empresa)?.cuota_mercado_pct ?? 0),
    0
  );
  const cantidadEmpresas = new Set(filas.filter((f) => f.empresa !== "Others").map((f) => f.empresa)).size;

  const empresas = Array.from(new Set(filas.map((f) => f.empresa))).sort((a, b) => {
    const cuotaA = filasUltimoAnio.find((f) => f.empresa === a)?.cuota_mercado_pct ?? 0;
    const cuotaB = filasUltimoAnio.find((f) => f.empresa === b)?.cuota_mercado_pct ?? 0;
    return cuotaB - cuotaA;
  });
  const columnasPivot: ColumnaTabla<EmpresaPivotRow>[] = [
    { key: "empresa", label: "Empresa", align: "left", format: "texto" },
    ...anios.map((anio) => ({ key: String(anio), label: String(anio), align: "right" as const, format: "porcentaje" as const })),
  ];
  const filasPivot: EmpresaPivotRow[] = empresas.map((empresa) => {
    const fila: EmpresaPivotRow = { empresa };
    for (const anio of anios) {
      const dato = filas.find((f) => f.anio === anio && f.empresa === empresa);
      if (dato) fila[String(anio)] = dato.cuota_mercado_pct;
    }
    return fila;
  });

  return (
    <main className="p-6 md:p-8">
      <PageHeader
        title="Competencia"
        description="Evolución de cuotas de mercado por empresa yerbatera."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard label={`Líder de mercado ${ultimoAnio}`} value={`${lider.empresa} (${formatPct(lider.cuota_mercado_pct)})`} icon={Crown} />
        <KpiCard label={`Concentración top ${TOP_N}`} value={formatPct(cuotaTop4)} icon={Building2} />
        <KpiCard label="Empresas relevadas" value={String(cantidadEmpresas)} icon={Users} />
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-card-foreground mb-1">Cuotas de mercado por año</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Top {TOP_N} empresas por cuota en {ultimoAnio} + &quot;Otras&quot; (resto + categoría &quot;Others&quot; de la fuente)
        </p>
        <CuotasStackedChart data={data} series={series} />
      </div>

      <div className="mt-4 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-card-foreground mb-1">Histórico completo por empresa</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Cuota de mercado (%) por año, desde {anios[0]} hasta {ultimoAnio}. La fuente solo publica granularidad anual (no mensual).
        </p>
        <DataTable columnas={columnasPivot} filas={filasPivot} maxHeightPx={480} />
      </div>
    </main>
  );
}
