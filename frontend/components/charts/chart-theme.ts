// Tokens visuales compartidos por todos los charts de Recharts de la app
// (ver Fase 9, A4) -- antes GRID_COLOR/TICK_COLOR estaban duplicados
// literal en 5 archivos, cada uno podía desviarse sin que se notara.

export const GRID_COLOR = "#e2e8e4";
export const TICK_COLOR = "#64748b";

/** Tamaño de fuente de eje (A4: "Ejes: 11px"). */
export const AXIS_TICK_SIZE = 11;

export const AXIS_TICK_STYLE = { fontSize: AXIS_TICK_SIZE, fill: TICK_COLOR };

/** Curva lineal para series con pocos puntos (menos de ~24) -- un
 * "monotone"/"basis" interpola una forma suave que no existe en los datos
 * reales cuando hay pocos puntos (ver Fase 9, C5: el promedio mensual de
 * hoja verde con 12 puntos no debería verse como una curva suave). Series
 * densas (24+ puntos, ej. mensual multi-año) sí se benefician de monotone
 * para legibilidad. */
export function tipoCurva(n: number): "linear" | "monotone" {
  return n < 24 ? "linear" : "monotone";
}
