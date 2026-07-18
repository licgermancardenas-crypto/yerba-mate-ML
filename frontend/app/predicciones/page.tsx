import Link from "next/link";
import { Sprout, Coffee, Ship } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ChartCard } from "@/components/chart-card";
import { ReliabilityBadge } from "@/components/reliability-badge";
import { ForecastBandChart, type PuntoForecast } from "@/components/charts/forecast-band-chart";
import { FooterFuentes } from "@/components/footer-fuentes";
import { formatNumero } from "@/lib/format";
import { getHojaVerde, getSalidaMolino, getPredicciones } from "@/lib/api";
import { MESES, agregarSalidaMolinoMensual } from "@/lib/agregaciones";
import { PAISES_DESTINO } from "@/lib/paises-destino";
import type { PrediccionRow } from "@/lib/types";

// 'ZONA CENTRO' -> 'CENTRO', etc. -- ym.inym_hoja_verde_zona (fuente real)
// usa el prefijo "ZONA " salvo en Corrientes; ym.ml_predicciones (salida del
// Modelo 1) ya guarda el nombre limpio -- ver backend/ml/build_panel_modelo1.py.
const ZONA_RAW_A_LIMPIA: Record<string, string> = {
  "ZONA CENTRO": "CENTRO",
  "ZONA NORESTE": "NORESTE",
  "ZONA NOROESTE": "NOROESTE",
  "ZONA OESTE": "OESTE",
  "ZONA SUR": "SUR",
  CORRIENTES: "CORRIENTES",
};
const ZONAS = ["CENTRO", "CORRIENTES", "NORESTE", "NOROESTE", "OESTE", "SUR"] as const;

// Texto de confiabilidad por zona -- ver docs/modelo1_produccion_zona.md
// (backtest walk-forward, MAE = % del promedio histórico de cada zona;
// MAPE de temporada alta abr-sep entre paréntesis).
const BACKTEST_MODELO1: Record<string, string> = {
  CENTRO:
    "MAE 23,6% del promedio histórico. En temporada alta sube a 54,8%: 2025 y 2026 tuvieron arranques de cosecha tardíos que el modelo (entrenado con 2012-2024) no anticipó.",
  CORRIENTES: "MAE 29,8% del promedio histórico, 25,0% en temporada alta (abr-sep).",
  NORESTE: "MAE 21,7% del promedio histórico, 24,5% en temporada alta (abr-sep).",
  NOROESTE: "MAE 21,7% del promedio histórico, 21,0% en temporada alta (abr-sep).",
  OESTE: "MAE 24,7% del promedio histórico, 25,2% en temporada alta (abr-sep).",
  SUR: "MAE 19,7% del promedio histórico, 21,2% en temporada alta (abr-sep).",
};

const TOP5_MODELO3 = ["SY", "CL", "ES", "LB", "US"] as const;

// Ver docs/modelo1_produccion_zona.md §6 -- hipótesis regulatoria, evidencia
// parcial y no concluyente, solo Corrientes tiene el dato atípico real.
const NOTA_REGULATORIA_CORRIENTES =
  "Oct 2025: 2,37M kg, 2-90x cualquier otro oct/nov de los 14 años de dataset (nov 2025 volvió a lo normal). Coincide con el proceso de desregulación yerbatera (Decreto 812/2025, nov 2025) que culminó en la Resolución 2/2026 (INYM, ene 2026) eliminando la veda de cosecha oct-nov -- sugestivo, no concluyente (un solo dato, una sola zona, la veda se eliminó formalmente después de este pico). Ver docs/modelo1_produccion_zona.md §6.";

function etiquetaMes(anio: number, mes: number): string {
  return `${MESES[mes - 1].slice(0, 3)} ${String(anio).slice(2)}`;
}

/** Une histórico real (mensual) + pronóstico (ym.ml_predicciones) en una
 * sola serie cronológica para <ForecastBandChart>. Los dos rangos no se
 * superponen (el pronóstico arranca donde termina el histórico real), así
 * que alcanza con concatenar y ordenar. */
function armarSerieMensual(historico: { anio: number; mes: number; valor: number }[], predicciones: PrediccionRow[]): PuntoForecast[] {
  const puntos = [
    ...historico.map((h) => ({ anio: h.anio, mes: h.mes, real: h.valor, predicho: null, icInferior: null, icSuperior: null })),
    ...predicciones
      .filter((p) => p.mes != null)
      .map((p) => ({ anio: p.anio, mes: p.mes!, real: null, predicho: p.valor_predicho, icInferior: p.ic_inferior, icSuperior: p.ic_superior })),
  ];
  return puntos
    .sort((a, b) => a.anio - b.anio || a.mes - b.mes)
    .map((p) => ({ etiqueta: etiquetaMes(p.anio, p.mes), real: p.real, predicho: p.predicho, icInferior: p.icInferior, icSuperior: p.icSuperior }));
}

export default async function PrediccionesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const modelo = sp.modelo === "2" ? "2" : sp.modelo === "3" ? "3" : "1";

  const paramsSinModelo = new URLSearchParams(
    Object.entries(sp).flatMap(([k, v]) => (k === "modelo" || v === undefined ? [] : [[k, String(v)]]))
  );
  const hrefTab = (m: "1" | "2" | "3") => {
    const params = new URLSearchParams(paramsSinModelo);
    params.set("modelo", m);
    return `/predicciones?${params.toString()}`;
  };

  return (
    <main className="p-6 md:p-8">
      <PageHeader
        title="ML / Predicciones"
        description="Pronósticos de los 3 modelos de Fase 5 -- cada pestaña indica el error real medido en backtest, no solo el pronóstico."
      />

      <div className="flex flex-wrap items-center gap-2 mb-6">
        {(
          [
            { m: "1" as const, label: "Producción por zona", icon: Sprout },
            { m: "2" as const, label: "Consumo interno", icon: Coffee },
            { m: "3" as const, label: "Exportaciones", icon: Ship },
          ]
        ).map(({ m, label, icon: Icon }) => (
          <Link
            key={m}
            href={hrefTab(m)}
            aria-current={modelo === m ? "page" : undefined}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-full border transition-colors ${
              modelo === m
                ? "bg-primary border-primary text-on-primary shadow-sm"
                : "border-border bg-card text-foreground/70 hover:text-foreground hover:border-primary/40"
            }`}
          >
            <Icon size={14} aria-hidden="true" />
            {label}
          </Link>
        ))}
      </div>

      {modelo === "1" && <TabProduccion />}
      {modelo === "2" && <TabConsumo />}
      {modelo === "3" && <TabExportaciones />}
    </main>
  );
}

async function TabProduccion() {
  const [hojaVerdeCompleta, prediccionesCompletas] = await Promise.all([
    getHojaVerde(),
    getPredicciones({ modelo: "modelo1_produccion_zona" }),
  ]);

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {ZONAS.map((zona) => {
          const historico = hojaVerdeCompleta
            .filter((f) => (ZONA_RAW_A_LIMPIA[f.zona] ?? f.zona) === zona)
            .map((f) => ({ anio: f.anio, mes: f.mes, valor: f.hoja_verde_kg }));
          const predicciones = prediccionesCompletas.filter((p) => p.dimension === zona);
          const datos = armarSerieMensual(historico, predicciones);

          return (
            <ChartCard
              key={zona}
              title={zona.charAt(0) + zona.slice(1).toLowerCase()}
              description="Ingreso de hoja verde a secadero -- histórico real + pronóstico 12 meses (SARIMA)"
            >
              <ForecastBandChart
                data={datos}
                numberFormat={{ notation: "compact" }}
                suffix=" kg"
                referencia={zona === "CORRIENTES" ? { etiqueta: etiquetaMes(2025, 10), texto: "Resolución 2/2026" } : undefined}
              />
              <ReliabilityBadge tipo="backtest" texto={BACKTEST_MODELO1[zona]} className="mt-3" />
              {zona === "CORRIENTES" && <p className="text-xs text-muted-foreground mt-2">{NOTA_REGULATORIA_CORRIENTES}</p>}
            </ChartCard>
          );
        })}
      </div>
      <FooterFuentes tablas={["ym.inym_hoja_verde_zona", "ym.ml_predicciones"]} />
    </>
  );
}

async function TabConsumo() {
  const [salidaMolinoCompleta, predicciones] = await Promise.all([
    getSalidaMolino(),
    getPredicciones({ modelo: "modelo2_consumo_interno" }),
  ]);
  const historico = agregarSalidaMolinoMensual(salidaMolinoCompleta)
    .slice()
    .sort((a, b) => a.anio - b.anio || a.mes - b.mes)
    .map((f) => ({ anio: f.anio, mes: f.mes, valor: f.interno_kg }));
  const datos = armarSerieMensual(historico, predicciones);

  return (
    <>
      <ChartCard title="Consumo interno (salida de molino al mercado interno)" description="Histórico real + pronóstico 12 meses (SARIMA)">
        <ForecastBandChart data={datos} numberFormat={{ notation: "compact" }} suffix=" kg" />
        <ReliabilityBadge tipo="backtest" texto="MAPE 6,3% (backtest walk-forward, 60 meses) -- el más preciso de los 3 modelos." className="mt-3" />
      </ChartCard>
      <FooterFuentes tablas={["ym.inym_salida_molino", "ym.ml_predicciones"]} />
    </>
  );
}

async function TabExportaciones() {
  const [ajustado, proyeccion] = await Promise.all([
    getPredicciones({ modelo: "modelo3_exportaciones", esPronostico: false }),
    getPredicciones({ modelo: "modelo3_exportaciones", esPronostico: true }),
  ]);

  return (
    <>
      <ReliabilityBadge
        tipo="supuesto"
        texto="Este modelo explica el patrón de comercio (R²=0,42, todos los coeficientes significativos) mucho mejor de lo que pronostica el volumen exacto de un país -- MAPE 145% en backtest walk-forward por país. Ver docs/modelo3_exportaciones_gravitacional.md."
        className="mb-4"
      />

      <div className="mb-2 text-sm font-semibold text-foreground">Ajustado vs. real -- top 5 destinos (86%+ del volumen real)</div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        {TOP5_MODELO3.map((pais) => {
          const datos: PuntoForecast[] = ajustado
            .filter((p) => p.dimension === pais)
            .sort((a, b) => a.anio - b.anio)
            .map((p) => ({
              etiqueta: String(p.anio),
              real: p.valor_real,
              predicho: p.valor_predicho,
              icInferior: p.ic_inferior,
              icSuperior: p.ic_superior,
            }));
          return (
            <ChartCard key={pais} title={PAISES_DESTINO[pais]?.label ?? pais} description="Volumen real vs. ajustado por el modelo, por año">
              <ForecastBandChart data={datos} numberFormat={{ notation: "compact" }} suffix=" kg" />
            </ChartCard>
          );
        })}
      </div>

      <div className="mb-2 text-sm font-semibold text-foreground">Proyección {proyeccion[0]?.anio ?? ""} -- los 20 países del modelo</div>
      <p className="text-xs text-muted-foreground mb-3">
        No hay PBI ni tipo de cambio futuros reales -- se asume que quedan congelados en el último dato real conocido de cada país (distinto por país, ver columna &ldquo;Supuesto&rdquo;).
      </p>
      <div className="rounded-lg border border-border overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted border-b border-border text-left">País</th>
              <th className="px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted border-b border-border text-right">Volumen proyectado (kg)</th>
              <th className="px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted border-b border-border text-right">IC 95%</th>
              <th className="px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted border-b border-border text-left">Supuesto</th>
            </tr>
          </thead>
          <tbody>
            {proyeccion
              .slice()
              .sort((a, b) => b.valor_predicho - a.valor_predicho)
              .map((p) => (
                <tr key={p.dimension} className="border-b border-border/60 last:border-0 hover:bg-primary/5 transition-colors">
                  <td className="px-3 py-1.5 text-card-foreground">{PAISES_DESTINO[p.dimension]?.label ?? p.dimension}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-medium text-card-foreground">{formatNumero(p.valor_predicho, 0)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                    {p.ic_inferior != null && p.ic_superior != null
                      ? `${formatNumero(p.ic_inferior, 0)} – ${formatNumero(p.ic_superior, 0)}`
                      : "s/d"}
                  </td>
                  <td className="px-3 py-1.5">
                    <ReliabilityBadge tipo="supuesto" texto={p.supuestos ?? ""} />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <FooterFuentes tablas={["ym.exportaciones_indec", "ym.pbi_pais_anual", "ym.tipo_cambio_anual", "ym.ml_predicciones"]} />
    </>
  );
}
