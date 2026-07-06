import { Users, Crown, Building2, Gauge, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { GaugeCard } from "@/components/gauge-card";
import { ChartCard } from "@/components/chart-card";
import { FilterBar } from "@/components/filter-bar";
import { AnnualChartConFiltro } from "@/components/charts/annual-chart-con-filtro";
import { DataTable, type ColumnaTabla } from "@/components/data-table";
import { formatPct } from "@/lib/format";
import { getCompetencia } from "@/lib/api";
import { calcularConcentracion, HHI_UMBRAL_ALTO, HHI_UMBRAL_MODERADO } from "@/lib/metricas-competencia";

type EmpresaPivotRow = { empresa: string } & Record<string, string | number>;

// Paleta validada con scripts/validate_palette.js de la skill dataviz — mantener el orden
const COLORES = ["#15803d", "#1d4ed8", "#a16207", "#92400e", "#7e22ce"];
const TOP_N = 4;
// Por debajo de esta cobertura (% de la cuota total con dato real) un año no
// entra al chart apilado — un 17% conocido no representa "el mercado", solo
// engañaría. Sigue disponible en la tabla histórica con "s/d" en el resto.
const COBERTURA_MINIMA_CHART = 50;

const COBERTURA_LABELS: Record<string, string> = {
  top20_de_65: "top 20 de 65 empresas del ranking",
  parcial: "dato parcial, sin ranking completo",
};

export default async function CompetenciaPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const empresaFiltro = typeof sp.empresa === "string" ? sp.empresa : undefined;

  const filasCompletas = await getCompetencia();
  const todosLosAnios = Array.from(new Set(filasCompletas.map((f) => f.anio))).sort((a, b) => a - b);
  const todasLasEmpresas = Array.from(new Set(filasCompletas.map((f) => f.empresa))).sort();
  const aniosConDatoReal = Array.from(
    new Set(filasCompletas.filter((f) => f.cuota_mercado_pct !== null).map((f) => f.anio))
  ).sort((a, b) => a - b);
  const primerAnioConDato = aniosConDatoReal[0];

  const anioDesde = Number(sp.anio_desde) || primerAnioConDato;
  const anioHasta = Number(sp.anio_hasta) || undefined;

  const filas = filasCompletas.filter(
    (f) =>
      (!anioDesde || f.anio >= anioDesde) &&
      (!anioHasta || f.anio <= anioHasta) &&
      (!empresaFiltro || f.empresa === empresaFiltro)
  );

  if (filas.length === 0) {
    return (
      <main className="p-6 md:p-8">
        <PageHeader title="Competencia" description="Evolución de cuotas de mercado por empresa yerbatera." />
        <FilterBar
          anios={todosLosAnios}
          anioDesdeDefault={primerAnioConDato}
          dimension={{ param: "empresa", label: "Empresa", opciones: todasLasEmpresas }}
        />
        <p className="text-sm text-muted-foreground">Sin datos para los filtros seleccionados.</p>
      </main>
    );
  }

  const anios = Array.from(new Set(filas.map((f) => f.anio))).sort((a, b) => a - b);
  const ultimoAnio = anios[anios.length - 1];

  const filasUltimoAnio = filas.filter((f) => f.anio === ultimoAnio);
  const conDatoUltimoAnio = filasUltimoAnio
    .filter((f) => f.cuota_mercado_pct !== null)
    .sort((a, b) => b.cuota_mercado_pct! - a.cuota_mercado_pct!);
  const sinDatoUltimoAnio = filasUltimoAnio.filter((f) => f.cuota_mercado_pct === null);

  const topEmpresas = conDatoUltimoAnio
    .filter((f) => f.empresa !== "Others")
    .slice(0, TOP_N)
    .map((f) => f.empresa);
  const series = [
    ...topEmpresas.map((empresa, i) => ({ key: empresa, color: COLORES[i] })),
    { key: "Otras", color: COLORES[COLORES.length - 1] },
  ];

  // Solo entran al chart apilado los años con cobertura suficiente — mostrar
  // un año con 2 de 15 empresas conocidas como si fuera "el mercado completo"
  // sería el mismo tipo de error que esta auditoría vino a corregir.
  const dataChart = anios
    .map((anio) => {
      const filasAnio = filas.filter((f) => f.anio === anio);
      const conocidas = filasAnio.filter((f) => f.cuota_mercado_pct !== null);
      const cobertura = conocidas.reduce((acc, f) => acc + f.cuota_mercado_pct!, 0);
      if (cobertura < COBERTURA_MINIMA_CHART) return null;
      const fila: Record<string, string | number> = { anio: String(anio) };
      let otras = 0;
      for (const f of conocidas) {
        if (topEmpresas.includes(f.empresa)) fila[f.empresa] = f.cuota_mercado_pct!;
        else otras += f.cuota_mercado_pct!;
      }
      fila["Otras"] = Number(otras.toFixed(2));
      return fila;
    })
    .filter((f): f is Record<string, string | number> => f !== null);
  const aniosExcluidosDelChart = anios.length - dataChart.length;

  const lider = conDatoUltimoAnio[0];
  const cuotaTop4 = topEmpresas.reduce(
    (acc, empresa) => acc + (conDatoUltimoAnio.find((f) => f.empresa === empresa)?.cuota_mercado_pct ?? 0),
    0
  );

  const concentracion = calcularConcentracion(filasUltimoAnio.map((f) => f.cuota_mercado_pct));
  const coberturaLabelUltimoAnio =
    COBERTURA_LABELS[filasUltimoAnio.find((f) => f.cobertura_ranking)?.cobertura_ranking ?? ""] ??
    "cobertura sin documentar";

  const dataHhi = anios
    .map((anio) => {
      const filasAnio = filas.filter((f) => f.anio === anio);
      const c = calcularConcentracion(filasAnio.map((f) => f.cuota_mercado_pct));
      if (c.coberturaPct < COBERTURA_MINIMA_CHART) return null;
      return { anio: String(anio), hhi: c.hhi, coberturaPct: c.coberturaPct };
    })
    .filter((f): f is { anio: string; hhi: number; coberturaPct: number } => f !== null);

  const empresas = Array.from(new Set(filas.map((f) => f.empresa))).sort((a, b) => {
    const cuotaA = conDatoUltimoAnio.find((f) => f.empresa === a)?.cuota_mercado_pct ?? -1;
    const cuotaB = conDatoUltimoAnio.find((f) => f.empresa === b)?.cuota_mercado_pct ?? -1;
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
      if (dato?.cuota_mercado_pct !== null && dato?.cuota_mercado_pct !== undefined) {
        fila[String(anio)] = dato.cuota_mercado_pct;
      }
    }
    return fila;
  });

  return (
    <main className="p-6 md:p-8">
      <PageHeader
        title="Competencia"
        description="Evolución de cuotas de mercado por empresa yerbatera."
      />

      <FilterBar
        anios={todosLosAnios}
        anioDesdeDefault={primerAnioConDato}
        dimension={{ param: "empresa", label: "Empresa", opciones: todasLasEmpresas }}
      />

      <div className="mb-6 rounded-2xl border border-border bg-card p-4 shadow-sm flex gap-3">
        <AlertTriangle size={18} className="text-accent shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-xs text-muted-foreground">
          <strong className="text-card-foreground">Auditoría 2026-07-04:</strong> el histórico 2011-2024 que se mostraba antes era relleno
          sintético sin fuente real (ver <code>docs/fuentes_competencia.md</code>). Solo se cargaron{" "}
          {aniosConDatoReal.join(" y ")} con ranking publicado y citado. 2022-2024 quedan sin dato (no inventado) — coincide con la
          desregulación del sector (DNU 70/2023, dic-2023); no se puede graficar ese quiebre hasta conseguir los rankings de esos años.
        </p>
      </div>

      {lider && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KpiCard label={`Líder de mercado ${ultimoAnio}`} value={`${lider.empresa} (${formatPct(lider.cuota_mercado_pct!)})`} icon={Crown} destacado />
          <GaugeCard label={`Concentración top ${TOP_N}`} valorPct={cuotaTop4} icon={Building2} color="var(--color-accent)" />
          <KpiCard
            label={`HHI ${ultimoAnio}`}
            value={String(Math.round(concentracion.hhi))}
            icon={Gauge}
          />
          <KpiCard
            label="Empresas con dato publicado"
            value={`${conDatoUltimoAnio.length} (${coberturaLabelUltimoAnio})`}
            icon={Users}
          />
        </div>
      )}

      {sinDatoUltimoAnio.length > 0 && (
        <p className="text-xs text-muted-foreground mb-6 -mt-4">
          {sinDatoUltimoAnio.length} empresa{sinDatoUltimoAnio.length > 1 ? "s" : ""} sin dato publicado en {ultimoAnio}:{" "}
          {sinDatoUltimoAnio.map((f) => f.empresa).join(", ")}.
        </p>
      )}

      <ChartCard
        title="Cuotas de mercado por año"
        description={
          <>
            Top {TOP_N} empresas por cuota en {ultimoAnio} + &quot;Otras&quot; (resto + categoría &quot;Others&quot; de la fuente).
            {aniosExcluidosDelChart > 0 &&
              ` ${aniosExcluidosDelChart} año(s) del rango seleccionado no se grafican por tener menos del ${COBERTURA_MINIMA_CHART}% del mercado con dato real (quedan en la tabla histórica con "s/d").`}
          </>
        }
      >
        {dataChart.length > 0 ? (
          <AnnualChartConFiltro tipo="cuotas" data={dataChart} series={series} />
        ) : (
          <p className="text-sm text-muted-foreground py-12 text-center">Ningún año del rango seleccionado tiene cobertura suficiente para graficar.</p>
        )}
      </ChartCard>

      <ChartCard
        title="HHI (Herfindahl-Hirschman) por año"
        className="mt-4"
        description={
          <>
            Suma de las cuotas conocidas al cuadrado (en puntos porcentuales). Es una <strong>cota inferior</strong> del HHI real: como
            &quot;Others&quot; agrega varias empresas chicas en un solo bloque, el HHI real es igual o mayor. Umbrales de referencia: &lt;1500 no
            concentrado, 1500-2500 moderadamente concentrado, &gt;2500 altamente concentrado.
          </>
        }
      >
        {dataHhi.length > 0 ? (
          <AnnualChartConFiltro tipo="hhi" data={dataHhi} />
        ) : (
          <p className="text-sm text-muted-foreground py-12 text-center">Ningún año del rango seleccionado tiene cobertura suficiente para calcular HHI de forma confiable.</p>
        )}
      </ChartCard>

      <ChartCard
        title="Histórico completo por empresa"
        className="mt-4"
        description={
          <>
            Cuota de mercado (%) por año, desde {anios[0]} hasta {ultimoAnio}. La fuente solo publica granularidad anual (no mensual).
            &quot;s/d&quot; = sin dato publicado para ese año (no es 0%).
          </>
        }
      >
        <DataTable columnas={columnasPivot} filas={filasPivot} maxHeightPx={480} />
      </ChartCard>
    </main>
  );
}
