"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { DeltaBadge, deltaClasses } from "@/components/delta-badge";
import { NoData } from "@/components/no-data";
import { pillClass } from "@/components/mapa-controles";
import { calcularVarPct } from "@/lib/agregaciones";

const MESES_ABREV = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// Rampa semáforo (mín=rojo -> máx=verde), 7 pasos, tokens en globals.css --
// a pedido explícito del usuario, reemplaza la rampa de un solo verde que
// tenía este componente antes (esa era intencional: acá el valor bajo no es
// "malo", es estacionalidad). Sigue siendo puramente relativa al rango
// mostrado (sin cero semántico) -- la leyenda debajo de la tabla lo aclara.
const PASOS = 7;
// La rampa NO es monótona en luminancia (rojo/naranja/verde oscuro piden
// texto blanco, amarillo/lima piden texto oscuro) -- por eso cada paso trae
// su propio par de tokens en vez de un solo corte de contraste.
const HEATMAP_VARS = Array.from({ length: PASOS }, (_, i) => ({
  bg: `var(--heatmap-${i + 1})`,
  texto: `var(--heatmap-text-${i + 1})`,
}));

export interface HeatmapTablePunto {
  anio: number;
  mes: number; // 1-12
  valor: number | null;
}

export interface HeatmapTableSerie {
  /** Clave estable: zona, pais_iso2, "interno"/"externo", "hoja_verde"/"canchada"... */
  id: string;
  /** Texto del selector/pill. */
  label: string;
  puntos: HeatmapTablePunto[];
}

interface HeatmapTableProps {
  /** Siempre array -- 1 elemento = sin selector de serie visible. */
  series: HeatmapTableSerie[];
  formatearValor: (v: number) => string;
  formatearTotal?: (v: number) => string;
  /** "Zona" | "Destino" | "Origen" | "Serie" -- solo se usa si series.length > 1. */
  selectorLabel?: string;
  defaultEscala?: "fila" | "global";
  className?: string;
}

function pasoColor(valor: number, min: number, max: number): number {
  if (max === min) return Math.floor(PASOS / 2);
  const t = (valor - min) / (max - min);
  return Math.min(PASOS - 1, Math.floor(t * PASOS));
}

function construirGrilla(puntos: HeatmapTablePunto[]): Map<number, (number | null)[]> {
  const porAnio = new Map<number, (number | null)[]>();
  for (const p of puntos) {
    if (!porAnio.has(p.anio)) porAnio.set(p.anio, Array(12).fill(null));
    porAnio.get(p.anio)![p.mes - 1] = p.valor;
  }
  return porAnio;
}

function botonToggleClase(activo: boolean): string {
  return `px-3 py-1 text-xs font-medium rounded-md transition-colors ${
    activo ? "bg-card text-card-foreground shadow-sm" : "text-muted-foreground hover:text-card-foreground"
  }`;
}

function StatChip({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold text-card-foreground tabular-nums mt-0.5">{valor}</div>
    </div>
  );
}

/** CSV de la serie activa -- valores brutos (no formateados con unidad/kg/t,
 * más útil para reabrir en Excel y seguir operando), respeta el mismo NULL
 * "sin dato" de la tabla (celda vacía, nunca 0). Exporta siempre valor + Var%
 * anual, independiente del toggle Valor/Variación en pantalla -- ese toggle
 * es una vista efímera de UI, el CSV es un artefacto que debería quedar
 * completo por sí solo. */
function construirCsv(
  anios: number[],
  porAnio: Map<number, (number | null)[]>,
  totalPorAnio: Map<number, number | null>,
  varPctPorAnio: Map<number, number | null>,
  promedioPorMes: (number | null)[]
): string {
  const encabezado = ["Año", ...MESES_ABREV, "Total anual", "Var % anual"];
  const filaPromedio = ["Promedio", ...promedioPorMes.map((v) => (v !== null ? v.toFixed(2) : "")), "", ""];
  const filasAnio = anios.map((anio) => {
    const valores = porAnio.get(anio)!;
    const total = totalPorAnio.get(anio) ?? null;
    const varPct = varPctPorAnio.get(anio) ?? null;
    return [
      String(anio),
      ...valores.map((v) => (v !== null ? v.toFixed(2) : "")),
      total !== null ? total.toFixed(2) : "",
      varPct !== null ? varPct.toFixed(1) : "",
    ];
  });
  const filas = [encabezado, filaPromedio, ...filasAnio];
  return filas.map((fila) => fila.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
}

function descargarCsv(contenido: string, nombreArchivo: string) {
  // BOM UTF-8 -- sin esto Excel en Windows a veces malinterpreta acentos/ñ
  // del encabezado ("Año") como otra codificación.
  const blob = new Blob([`﻿${contenido}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  a.click();
  URL.revokeObjectURL(url);
}

/** Celda "s/d" reusada para valor y variación -- mismo criterio de honestidad
 * (nunca inventar un número donde falta la fuente o el mes anterior no es
 * consecutivo). */
function CeldaSinDato({ motivo }: { motivo: string }) {
  return (
    <td title={motivo} className="px-2 py-1.5 text-center tabular-nums text-muted-foreground italic cursor-help">
      s/d
    </td>
  );
}

/** Años como filas, meses como columnas, con rampa semáforo de magnitud,
 * variación año-a-año (columna, siempre visible) y mes-a-mes (toggle, celdas
 * de la grilla), selector de serie (zona/destino/país) cuando aplica, escala
 * fila/global, y una franja de KPIs (total/promedio/máx/mín del período
 * mostrado). Ver docs de Fase 9/rediseño 2026-07-19 para el detalle de
 * diseño (rampa no monótona, honestidad de NULL en variación mes-a-mes). */
export function HeatmapTable({
  series,
  formatearValor,
  formatearTotal,
  selectorLabel,
  defaultEscala = "fila",
  className = "",
}: HeatmapTableProps) {
  const formatearTot = formatearTotal ?? formatearValor;
  const [serieId, setSerieId] = useState<string | undefined>(series[0]?.id);
  const [escala, setEscala] = useState<"fila" | "global">(defaultEscala);
  const [vista, setVista] = useState<"valor" | "variacion">("valor");

  const serieActiva = series.find((s) => s.id === serieId) ?? series[0];
  const puntos = serieActiva?.puntos ?? [];

  const porAnio = construirGrilla(puntos);
  const anios = Array.from(porAnio.keys()).sort((a, b) => a - b);

  if (!serieActiva || anios.length === 0) {
    return <NoData variant="chart" motivo="Sin datos para los filtros seleccionados." />;
  }

  const totalPorAnio = new Map<number, number | null>();
  for (const anio of anios) {
    const valores = porAnio.get(anio)!.filter((v): v is number => v !== null);
    totalPorAnio.set(anio, valores.length ? valores.reduce((a, b) => a + b, 0) : null);
  }

  // Variación año a año -- calculada una sola vez (reusada por la tabla y
  // por la descarga CSV). Comparación "mismo período": solo suma los meses
  // presentes en AMBOS años, no el total completo del año anterior contra
  // un año en curso todavía parcial.
  const varPctPorAnio = new Map<number, number | null>();
  for (let i = 0; i < anios.length; i++) {
    if (i === 0) {
      varPctPorAnio.set(anios[i], null);
      continue;
    }
    const valoresMes = porAnio.get(anios[i])!;
    const valoresMesAnterior = porAnio.get(anios[i - 1])!;
    let sumaActual = 0;
    let sumaAnterior = 0;
    let comparable = false;
    for (let m = 0; m < 12; m++) {
      const actual = valoresMes[m];
      const anterior = valoresMesAnterior[m];
      if (actual !== null && anterior !== null) {
        sumaActual += actual;
        sumaAnterior += anterior;
        comparable = true;
      }
    }
    varPctPorAnio.set(anios[i], calcularVarPct(sumaActual, comparable ? sumaAnterior : null));
  }

  // Promedio por mes calendario, a través de todos los años mostrados --
  // excluido a propósito del cálculo de min/max de la rampa y de la
  // secuencia de variación mes-a-mes (no es un año más, es un resumen).
  const promedioPorMes: (number | null)[] = Array.from({ length: 12 }, (_, m) => {
    const valores = anios.map((a) => porAnio.get(a)![m]).filter((v): v is number => v !== null);
    return valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : null;
  });

  // KPIs sobre exactamente lo que está en pantalla (serie activa, años ya
  // filtrados por la página antes de llegar acá).
  const todosLosValores = puntos.map((p) => p.valor).filter((v): v is number => v !== null);
  const totalPeriodo = todosLosValores.length ? todosLosValores.reduce((a, b) => a + b, 0) : null;
  const promedioMensual = totalPeriodo !== null ? totalPeriodo / todosLosValores.length : null;
  let maximo: { valor: number; anio: number; mes: number } | null = null;
  let minimo: { valor: number; anio: number; mes: number } | null = null;
  for (const p of puntos) {
    if (p.valor === null) continue;
    if (!maximo || p.valor > maximo.valor) maximo = { valor: p.valor, anio: p.anio, mes: p.mes };
    if (!minimo || p.valor < minimo.valor) minimo = { valor: p.valor, anio: p.anio, mes: p.mes };
  }

  // Variación mes a mes: secuencia cronológica plana -- cada celda compara
  // SOLO contra el mes calendario inmediatamente anterior (dic->ene cruza
  // año). Si ese mes anterior no es consecutivo o falta, da null -- nunca
  // salta el hueco para comparar contra un mes más viejo (fabricaría una
  // variación implícita sobre un período que no midió nada).
  const secuencia = [...puntos].sort((a, b) => a.anio - b.anio || a.mes - b.mes);
  const momPorAnioMes = new Map<string, number | null>();
  for (let i = 0; i < secuencia.length; i++) {
    const actual = secuencia[i];
    const anterior = i > 0 ? secuencia[i - 1] : null;
    let esConsecutivo = false;
    if (anterior) {
      const mesEsperado = anterior.mes === 12 ? 1 : anterior.mes + 1;
      const anioEsperado = anterior.mes === 12 ? anterior.anio + 1 : anterior.anio;
      esConsecutivo = actual.mes === mesEsperado && actual.anio === anioEsperado;
    }
    momPorAnioMes.set(`${actual.anio}-${actual.mes}`, esConsecutivo ? calcularVarPct(actual.valor, anterior!.valor) : null);
  }

  const globalValores = puntos.map((p) => p.valor).filter((v): v is number => v !== null);
  const globalMin = globalValores.length ? Math.min(...globalValores) : 0;
  const globalMax = globalValores.length ? Math.max(...globalValores) : 0;

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        {series.length > 1 &&
          (series.length <= 6 ? (
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={selectorLabel ?? "Serie"}>
              {series.map((s) => (
                <button key={s.id} type="button" onClick={() => setSerieId(s.id)} aria-pressed={s.id === serieId} className={pillClass(s.id === serieId)}>
                  {s.label}
                </button>
              ))}
            </div>
          ) : (
            // Ancho mayor que SELECT_CLASS (mapa-controles.tsx) a propósito --
            // esa constante está pensada para labels cortos ("Topográfico"),
            // acá hay nombres de países más largos ("Emiratos Árabes Unidos").
            <select
              value={serieId}
              onChange={(e) => setSerieId(e.target.value)}
              aria-label={selectorLabel ?? "Serie"}
              className="text-sm rounded-lg border border-border bg-background px-2.5 py-1.5 text-foreground w-full sm:w-64"
            >
              {series.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          ))}

        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted p-1 sm:ml-auto">
          <button type="button" onClick={() => setVista("valor")} aria-pressed={vista === "valor"} className={botonToggleClase(vista === "valor")}>
            Valor
          </button>
          <button
            type="button"
            onClick={() => setVista("variacion")}
            aria-pressed={vista === "variacion"}
            className={botonToggleClase(vista === "variacion")}
          >
            Variación % mes a mes
          </button>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted p-1">
          <button type="button" onClick={() => setEscala("fila")} aria-pressed={escala === "fila"} className={botonToggleClase(escala === "fila")}>
            Por año
          </button>
          <button
            type="button"
            onClick={() => setEscala("global")}
            aria-pressed={escala === "global"}
            className={botonToggleClase(escala === "global")}
          >
            Serie completa
          </button>
        </div>

        <button
          type="button"
          onClick={() =>
            descargarCsv(
              construirCsv(anios, porAnio, totalPorAnio, varPctPorAnio, promedioPorMes),
              `${serieActiva.label.replace(/\s+/g, "_")}.csv`
            )
          }
          title="Descargar esta tabla como CSV (valores brutos, sin formatear)"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-card text-foreground/70 hover:text-foreground hover:border-primary/40 transition-colors"
        >
          <Download size={13} aria-hidden="true" />
          CSV
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <StatChip label="Total del período" valor={totalPeriodo !== null ? formatearTot(totalPeriodo) : "s/d"} />
        <StatChip label="Promedio mensual" valor={promedioMensual !== null ? formatearValor(promedioMensual) : "s/d"} />
        <StatChip
          label="Máximo mensual"
          valor={maximo ? `${formatearValor(maximo.valor)} (${MESES_ABREV[maximo.mes - 1]} ${maximo.anio})` : "s/d"}
        />
        <StatChip
          label="Mínimo mensual"
          valor={minimo ? `${formatearValor(minimo.valor)} (${MESES_ABREV[minimo.mes - 1]} ${minimo.anio})` : "s/d"}
        />
      </div>

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
              <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">Var % anual</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border bg-muted/60">
              <td className="sticky left-0 z-10 bg-muted px-3 py-1.5 font-semibold text-muted-foreground whitespace-nowrap border-r border-border">
                Promedio
              </td>
              {promedioPorMes.map((v, i) => (
                <td key={i} className="px-2 py-1.5 text-center tabular-nums text-muted-foreground">
                  {v !== null ? formatearValor(v) : "s/d"}
                </td>
              ))}
              <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-muted-foreground whitespace-nowrap border-l border-border">
                {(() => {
                  const vals = promedioPorMes.filter((v): v is number => v !== null);
                  return vals.length ? formatearTot(vals.reduce((a, b) => a + b, 0)) : "s/d";
                })()}
              </td>
              <td className="px-3 py-1.5 text-right whitespace-nowrap text-muted-foreground">—</td>
            </tr>

            {anios.map((anio, i) => {
              const valoresMes = porAnio.get(anio)!;
              const valoresFila = valoresMes.filter((v): v is number => v !== null);
              const filaMin = valoresFila.length ? Math.min(...valoresFila) : 0;
              const filaMax = valoresFila.length ? Math.max(...valoresFila) : 0;
              const total = totalPorAnio.get(anio) ?? null;
              const varPctAnual = varPctPorAnio.get(anio) ?? null;

              return (
                <tr key={anio} className="border-b border-border/60 last:border-0">
                  <td className="sticky left-0 z-10 bg-card px-3 py-1.5 font-semibold text-card-foreground whitespace-nowrap border-r border-border">
                    {anio}
                  </td>
                  {valoresMes.map((valor, mIdx) => {
                    const mes = mIdx + 1;

                    if (vista === "variacion") {
                      const varMom = momPorAnioMes.get(`${anio}-${mes}`) ?? null;
                      if (valor === null || varMom === null) {
                        return (
                          <CeldaSinDato
                            key={mIdx}
                            motivo="Sin dato, o sin mes calendario inmediatamente anterior para comparar"
                          />
                        );
                      }
                      const redondeado = Math.round(varMom * 10) / 10;
                      return (
                        <td
                          key={mIdx}
                          title={`${MESES_ABREV[mIdx]} ${anio} vs. mes anterior`}
                          className={`px-2 py-1.5 text-center tabular-nums font-medium ${deltaClasses(varMom)}`}
                        >
                          {redondeado > 0 ? "+" : ""}
                          {redondeado.toFixed(1)}%
                        </td>
                      );
                    }

                    if (valor === null) {
                      return <CeldaSinDato key={mIdx} motivo="Sin dato publicado por la fuente para este período" />;
                    }
                    const min = escala === "fila" ? filaMin : globalMin;
                    const max = escala === "fila" ? filaMax : globalMax;
                    const paso = pasoColor(valor, min, max);
                    const { bg, texto } = HEATMAP_VARS[paso];
                    return (
                      <td
                        key={mIdx}
                        title={`${MESES_ABREV[mIdx]} ${anio}: ${formatearValor(valor)}`}
                        className="px-2 py-1.5 text-center tabular-nums font-medium"
                        style={{ backgroundColor: bg, color: texto }}
                      >
                        {formatearValor(valor)}
                      </td>
                    );
                  })}
                  <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-card-foreground whitespace-nowrap border-l border-border">
                    {total !== null ? formatearTot(total) : "s/d"}
                  </td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap">
                    {varPctAnual !== null ? (
                      <DeltaBadge valor={varPctAnual} base={`vs. ${anios[i - 1]}`} className="text-[11px]" />
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
        Color relativo al rango mostrado ({escala === "fila" ? "mínimo a máximo dentro de cada año" : "mínimo a máximo de toda la serie"}
        ) — un mes en rojo no es necesariamente un problema, es solo el valor más bajo de ese rango; el número exacto siempre está en la
        celda.
      </p>
    </div>
  );
}
