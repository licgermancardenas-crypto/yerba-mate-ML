import { DeltaBadge } from "@/components/delta-badge";
import { NoData } from "@/components/no-data";

const MESES_ABREV = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// Rampa secuencial de un solo hue (verde de marca), clara -> oscura, para
// codificar magnitud. Paso 5 es el primary de marca (--color-primary
// #15803d); no un rojo-amarillo-verde tipo semáforo, porque acá el valor
// bajo no es "malo" (estacionalidad de cosecha), es solo menor magnitud.
const RAMPA_VERDE = ["#f0fdf4", "#d1f5df", "#a8e8c0", "#78d69c", "#45bd76", "#15803d", "#0b5c2c"];
const UMBRAL_TEXTO_CLARO = 4;

export interface HeatmapTablePunto {
  anio: number;
  mes: number; // 1-12
  valor: number | null;
}

function pasoColor(valor: number, min: number, max: number): number {
  if (max === min) return Math.floor(RAMPA_VERDE.length / 2);
  const t = (valor - min) / (max - min);
  return Math.min(RAMPA_VERDE.length - 1, Math.floor(t * RAMPA_VERDE.length));
}

export function HeatmapTable({
  filas,
  formatearValor,
  formatearTotal,
  escala = "fila",
}: {
  filas: HeatmapTablePunto[];
  formatearValor: (v: number) => string;
  formatearTotal?: (v: number) => string;
  /** "fila": resalta el patrón estacional dentro de cada año. "global": resalta la tendencia entre años (útil cuando el dato no varía mes a mes). */
  escala?: "fila" | "global";
}) {
  const formatearTot = formatearTotal ?? formatearValor;

  const porAnio = new Map<number, (number | null)[]>();
  for (const f of filas) {
    if (!porAnio.has(f.anio)) porAnio.set(f.anio, Array(12).fill(null));
    porAnio.get(f.anio)![f.mes - 1] = f.valor;
  }
  const anios = Array.from(porAnio.keys()).sort((a, b) => a - b);

  const totalPorAnio = new Map<number, number | null>();
  for (const anio of anios) {
    const valores = porAnio.get(anio)!.filter((v): v is number => v !== null);
    totalPorAnio.set(anio, valores.length ? valores.reduce((a, b) => a + b, 0) : null);
  }

  const todosLosValores = filas.map((f) => f.valor).filter((v): v is number => v !== null);
  const globalMin = todosLosValores.length ? Math.min(...todosLosValores) : 0;
  const globalMax = todosLosValores.length ? Math.max(...todosLosValores) : 0;

  if (anios.length === 0) {
    return <NoData variant="chart" motivo="Sin datos para los filtros seleccionados." />;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-lg border border-border overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-primary text-on-primary">
              <th className="sticky left-0 z-10 bg-primary px-3 py-2 text-left font-semibold whitespace-nowrap">Año</th>
              {MESES_ABREV.map((m) => (
                <th key={m} className="px-2 py-2 text-center font-semibold whitespace-nowrap">
                  {m}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-semibold whitespace-nowrap border-l border-white/20">Total anual</th>
              <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">Var %</th>
            </tr>
          </thead>
          <tbody>
            {anios.map((anio, i) => {
              const valoresMes = porAnio.get(anio)!;
              const valoresFila = valoresMes.filter((v): v is number => v !== null);
              const filaMin = valoresFila.length ? Math.min(...valoresFila) : 0;
              const filaMax = valoresFila.length ? Math.max(...valoresFila) : 0;
              const total = totalPorAnio.get(anio) ?? null;
              // Comparación "mismo período": solo suma los meses presentes en
              // AMBOS años, no el total completo del año anterior contra un
              // año en curso todavía parcial (eso daba caídas falsas enormes,
              // ej. 5 meses de 2026 vs. los 12 de 2025 completo).
              const valoresMesAnterior = i > 0 ? porAnio.get(anios[i - 1])! : null;
              let sumaActual = 0;
              let sumaAnterior = 0;
              let comparable = false;
              if (valoresMesAnterior) {
                for (let m = 0; m < 12; m++) {
                  const actual = valoresMes[m];
                  const anterior = valoresMesAnterior[m];
                  if (actual !== null && anterior !== null) {
                    sumaActual += actual;
                    sumaAnterior += anterior;
                    comparable = true;
                  }
                }
              }
              const varPct = comparable && sumaAnterior !== 0 ? ((sumaActual - sumaAnterior) / sumaAnterior) * 100 : null;

              return (
                <tr key={anio} className="border-b border-border/60 last:border-0">
                  <td className="sticky left-0 z-10 bg-card px-3 py-1.5 font-semibold text-card-foreground whitespace-nowrap border-r border-border">
                    {anio}
                  </td>
                  {valoresMes.map((valor, mIdx) => {
                    if (valor === null) {
                      return (
                        <td
                          key={mIdx}
                          title="Sin dato publicado por la fuente para este período"
                          className="px-2 py-1.5 text-center tabular-nums text-muted-foreground italic cursor-help"
                        >
                          s/d
                        </td>
                      );
                    }
                    const min = escala === "fila" ? filaMin : globalMin;
                    const max = escala === "fila" ? filaMax : globalMax;
                    const paso = pasoColor(valor, min, max);
                    return (
                      <td
                        key={mIdx}
                        title={`${MESES_ABREV[mIdx]} ${anio}: ${formatearValor(valor)}`}
                        className={`px-2 py-1.5 text-center tabular-nums font-medium ${
                          paso >= UMBRAL_TEXTO_CLARO ? "text-white" : "text-[#14532d]"
                        }`}
                        style={{ backgroundColor: RAMPA_VERDE[paso] }}
                      >
                        {formatearValor(valor)}
                      </td>
                    );
                  })}
                  <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-card-foreground whitespace-nowrap border-l border-border">
                    {total !== null ? formatearTot(total) : "s/d"}
                  </td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap">
                    {varPct !== null ? (
                      <DeltaBadge valor={varPct} base={`vs. ${anios[i - 1]}`} className="text-[11px]" />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Color por magnitud, {escala === "fila" ? "de mínimo a máximo dentro de cada año" : "de mínimo a máximo en toda la serie"} — el valor exacto siempre está en el número, el color solo resalta el patrón.
      </p>
    </div>
  );
}
